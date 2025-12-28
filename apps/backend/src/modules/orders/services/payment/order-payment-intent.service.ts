import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PAISE_PER_RUPEE } from "../../../../common/constants/currency.constants";
import { RETRY_DELAY_MS } from "../../../../common/constants/timeout.constants";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { DiscountSnapshot } from "../../../discounts/engine/discount-engine.types";
import { PaymentsService } from "../../../payments/payments.service";
import { PaymentChargeService } from "../../../payments/services/payment-charge.service";
import { PricingSnapshot } from "../../../pricing/engine/pricing-engine.types";
import { PricingDriftDetectorService } from "../../../pricing/services/pricing-drift-detector.service";
import { CheckoutState } from "../../../redis-store/constants/checkout-states";
import { PaymentIntent } from "../../../redis-store/dto/payment-intent.dto";
import { CheckoutStore } from "../../../redis-store/stores/checkout-store";
import { OrderDiscountService } from "../discount/order-discount.service";

/**
 * Service responsible for payment intent creation and management
 * Handles payment intent creation, validation, retry logic, and drift detection
 */
@Injectable()
export class OrderPaymentIntentService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    readonly _paymentChargeService: PaymentChargeService,
    private readonly checkoutStore: CheckoutStore,
    private readonly discountService: OrderDiscountService,
    private readonly pricingDriftDetector: PricingDriftDetectorService,
  ) {}

  /**
   * Create payment intent for checkout
   * Validates amount includes payment fee and handles retry logic for placeholder responses
   */
  @Trace({ operation: "OrderPaymentIntentService.createPaymentIntent" })
  async createPaymentIntent(
    checkoutSessionId: string,
    total: number,
    subtotalAfterDiscount: number,
    totalGstAmount: number,
    shippingCost: number,
    paymentFee: number,
    paymentMethod: string | undefined,
    effectiveSubtotal: number,
    discountSnapshot?: DiscountSnapshot | null,
    pricingSnapshot?: PricingSnapshot | null,
  ): Promise<PaymentIntent> {
    // Assert checkout state is LOCKED before creating payment intent
    await this.checkoutStore.assertState(
      checkoutSessionId,
      CheckoutState.LOCKED,
    );

    // Create payment intent idempotently
    // Amount is in rupees, convert to paise for Razorpay
    // CRITICAL: Amount MUST include payment fee (already included in total calculation above)
    const amountInPaise = Math.round(total * PAISE_PER_RUPEE);

    // Verify amount includes fee before creating payment intent
    const expectedAmount =
      Math.round(
        (subtotalAfterDiscount + totalGstAmount + shippingCost) *
          PAISE_PER_RUPEE,
      ) + paymentFee;
    if (amountInPaise !== expectedAmount) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "paymentIntentAmountMismatch",
          new Error("Payment intent amount does not include fee"),
          {
            checkoutSessionId,
            amountInPaise,
            expectedAmount,
            paymentFee,
            subtotalAfterDiscount,
            totalGstAmount,
            shippingCost,
          },
        ),
        "Payment intent amount verification failed - fee not included",
      );
      throw new ConflictException(
        "Payment intent amount calculation error - fee must be included",
      );
    }

    let paymentIntent: PaymentIntent;
    try {
      paymentIntent = await this.paymentsService.createPaymentIntent(
        checkoutSessionId,
        amountInPaise,
        "INR",
        undefined, // receipt will be generated from checkoutSessionId
        {
          order_number: `pending-${Date.now()}`, // Temporary, will be updated after order creation
          payment_fee: paymentFee.toString(), // Store fee in notes for verification
          payment_method: paymentMethod || "unknown",
        },
      );

      if (!paymentIntent) {
        const errorMessage = `Payment intent creation returned null or undefined for checkoutSessionId=${checkoutSessionId}. This may indicate a payment provider issue. Please try again or contact support if the problem persists.`;
        this.logger.error(
          createErrorContext(
            this.contextService,
            "createPaymentIntent",
            new Error("Payment intent is null"),
            { checkoutSessionId, total },
          ),
          errorMessage,
        );
        throw new ConflictException(errorMessage);
      }

      // Handle placeholder case (empty paymentIntentId) - retry once after short delay
      if (
        !paymentIntent.paymentIntentId ||
        paymentIntent.paymentIntentId === ""
      ) {
        paymentIntent = await this.retryPaymentIntent(
          checkoutSessionId,
          paymentIntent,
        );
      }

      this.logger.info(
        createLogContext(this.contextService, "createPaymentIntent", {
          checkoutSessionId,
          paymentIntentId: paymentIntent.paymentIntentId,
          amount: amountInPaise,
          currency: "INR",
          paymentFee,
          paymentMethod,
          components: {
            subtotal: Math.round(subtotalAfterDiscount * PAISE_PER_RUPEE),
            gst: Math.round(totalGstAmount * PAISE_PER_RUPEE),
            shipping: Math.round(shippingCost * PAISE_PER_RUPEE),
            fee: paymentFee,
            total: amountInPaise,
          },
        }),
        "Payment intent created with fee included",
      );

      // Detect drift during payment intent creation (discounts)
      if (discountSnapshot) {
        await this.discountService.detectDiscountDrift(
          checkoutSessionId,
          total,
          amountInPaise / PAISE_PER_RUPEE, // Convert from paise to rupees
          discountSnapshot,
        );

        // Log snapshot creation
        await this.discountService.logDiscountSnapshotCreation(
          checkoutSessionId,
          discountSnapshot,
        );
      }

      // Detect pricing drift during payment intent creation
      if (pricingSnapshot) {
        try {
          await this.pricingDriftDetector.detectPaymentIntentDrift(
            checkoutSessionId,
            effectiveSubtotal,
            amountInPaise / PAISE_PER_RUPEE, // Convert from paise to rupees (total includes GST + shipping)
            pricingSnapshot,
          );
        } catch (error) {
          // Drift detected - block checkout
          this.logger.error(
            createErrorContext(
              this.contextService,
              "detectPricingDrift",
              error,
              {
                checkoutSessionId,
                effectiveSubtotal,
                total: amountInPaise / PAISE_PER_RUPEE,
              },
            ),
            "Pricing drift detected",
          );
          throw error;
        }
      }

      return paymentIntent;
    } catch (error) {
      // Payment intent creation failure - MUST BLOCK
      // This is a critical failure - we cannot proceed without payment intent
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isTimeoutError =
        error instanceof Error &&
        (error.message.includes("timed out") ||
          error.message.includes("timeout") ||
          error.name === "TimeoutError" ||
          error.name === "ProviderTimeoutError");
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("network"));

      let userFriendlyMessage: string;
      if (isTimeoutError) {
        userFriendlyMessage = `Payment intent creation timed out for checkoutSessionId=${checkoutSessionId}. The payment provider did not respond in time. This may be a temporary issue. Please try again in a few moments.`;
      } else if (isNetworkError) {
        userFriendlyMessage = `Network error while creating payment intent for checkoutSessionId=${checkoutSessionId}. Please check your connection and try again.`;
      } else {
        userFriendlyMessage = `Failed to create payment intent for checkoutSessionId=${checkoutSessionId}. ${errorMessage}. Please try again or contact support if the issue persists.`;
      }

      this.logger.error(
        createErrorContext(this.contextService, "createPaymentIntent", error, {
          checkoutSessionId,
          total,
          isTimeoutError,
          isNetworkError,
          errorType: error instanceof Error ? error.name : typeof error,
        }),
        `Failed to create payment intent${isTimeoutError ? " (timeout)" : isNetworkError ? " (network error)" : ""}`,
      );
      throw new ConflictException(userFriendlyMessage);
    }
  }

  /**
   * Retry payment intent retrieval for placeholder responses
   */
  private async retryPaymentIntent(
    checkoutSessionId: string,
    placeholderIntent: PaymentIntent,
  ): Promise<PaymentIntent> {
    this.logger.warn(
      createLogContext(this.contextService, "createPaymentIntent", {
        checkoutSessionId,
      }),
      `Payment intent returned with empty paymentIntentId (placeholder) for checkoutSessionId=${checkoutSessionId}, retrying after delay`,
    );
    // Wait a bit longer for concurrent creation to complete
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    // Try to get the payment intent again
    const retryPaymentIntent =
      await this.checkoutStore.getPaymentIntent(checkoutSessionId);
    if (
      retryPaymentIntent?.paymentIntentId &&
      retryPaymentIntent.paymentIntentId !== ""
    ) {
      this.logger.info(
        createLogContext(this.contextService, "createPaymentIntent", {
          checkoutSessionId,
          paymentIntentId: retryPaymentIntent.paymentIntentId,
        }),
        `Payment intent placeholder filled after retry for checkoutSessionId=${checkoutSessionId}`,
      );
      return retryPaymentIntent;
    } else {
      const errorMessage = `Payment intent creation returned invalid result - paymentIntentId is empty after retry for checkoutSessionId=${checkoutSessionId}. The payment provider call may have timed out or failed. Please try again or contact support.`;
      this.logger.error(
        createErrorContext(
          this.contextService,
          "createPaymentIntent",
          new Error("Payment intent placeholder not filled after retry"),
          { checkoutSessionId },
        ),
        errorMessage,
      );
      throw new ConflictException(errorMessage);
    }
  }
}
