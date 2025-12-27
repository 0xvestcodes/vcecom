import * as crypto from "node:crypto";
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { eq, orders, payments } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import Razorpay from "razorpay";
import { AppConfigService } from "../../common/config/app.config.service";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import { OrdersService } from "../orders/orders.service";
import { CheckoutState } from "../redis-store/constants/checkout-states";
import {
  PaymentIntent,
  PaymentIntentStatus,
} from "../redis-store/dto/payment-intent.dto";
import { CheckoutStore } from "../redis-store/stores/checkout-store";
import {
  CreateRazorpayOrderDto,
  RazorpayOrderResponseDto,
} from "./dto/create-razorpay-order.dto";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { RazorpayWebhookEventDto } from "./dto/webhook-event.dto";
import { RazorpayConfigService } from "./razorpay-config.service";

@Injectable()
export class PaymentsService implements OnModuleInit {
  private razorpay: Razorpay | null = null;

  constructor(
    private readonly razorpayConfigService: RazorpayConfigService,
    private readonly checkoutStore: CheckoutStore,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly appConfigService: AppConfigService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Initialize Razorpay on module initialization
   * Reads configuration from AppConfigService
   */
  onModuleInit() {
    const config = this.appConfigService.getRazorpayConfig();

    if (config.keyId && config.keySecret) {
      try {
        this.razorpay = this.razorpayConfigService.initialize({
          keyId: config.keyId,
          keySecret: config.keySecret,
          timeout: config.timeout,
        });
        this.logger.info(
          {
            keyId: `${config.keyId.substring(0, 10)}...`, // Log partial key for verification
            initialized: true,
            timeout: config.timeout,
          },
          "Razorpay initialized successfully with SDK-level timeout",
        );
      } catch (error) {
        this.logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            hasKeyId: !!config.keyId,
            hasKeySecret: !!config.keySecret,
            timeout: config.timeout,
          },
          "Failed to initialize Razorpay",
        );
      }
    } else {
      this.logger.warn(
        {
          hasKeyId: !!config.keyId,
          hasKeySecret: !!config.keySecret,
        },
        "Razorpay not initialized - missing environment variables",
      );
    }
  }

  /**
   * Get Razorpay instance
   * @returns Razorpay instance
   * @throws Error if Razorpay is not initialized
   */
  getRazorpayInstance(): Razorpay {
    if (!this.razorpay) {
      throw new Error(
        "Razorpay is not initialized. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.",
      );
    }
    return this.razorpay;
  }

  /**
   * Check if Razorpay is initialized
   * @returns true if Razorpay is initialized
   */
  isInitialized(): boolean {
    return this.razorpay !== null;
  }

  /**
   * Initialize Razorpay with custom configuration
   * @param keyId - Razorpay Key ID
   * @param keySecret - Razorpay Key Secret
   * @param timeout - Optional timeout in milliseconds (default: 10000)
   */
  initialize(keyId: string, keySecret: string, timeout?: number): void {
    this.razorpay = this.razorpayConfigService.initialize({
      keyId,
      keySecret,
      timeout,
    });
  }

  /**
   * Create payment intent idempotently for a checkout session
   * Ensures exactly one payment intent per checkout session
   * @param checkoutSessionId - Checkout session ID
   * @param amount - Amount in paise
   * @param currency - Currency code (default: INR)
   * @param receipt - Receipt ID (optional)
   * @param notes - Additional notes (optional)
   * @returns Payment intent
   */
  @Trace({ operation: "PaymentsService.createPaymentIntent" })
  async createPaymentIntent(
    checkoutSessionId: string,
    amount: number,
    currency: string = "INR",
    receipt?: string,
    notes?: Record<string, string>,
  ): Promise<PaymentIntent> {
    // Assert checkout state is LOCKED before creating payment intent
    await this.checkoutStore.assertState(
      checkoutSessionId,
      CheckoutState.LOCKED,
    );

    // Create or get payment intent atomically
    const paymentIntent = await this.checkoutStore.createOrGetPaymentIntent(
      checkoutSessionId,
      async () => {
        // This function is called only if payment intent doesn't exist
        // Check if Razorpay is initialized before proceeding
        if (!this.isInitialized()) {
          const config = this.appConfigService.getRazorpayConfig();
          this.logger.error(
            createErrorContext(
              this.contextService,
              "createPaymentIntent",
              new Error("Razorpay is not initialized"),
              {
                checkoutSessionId,
                hasKeyId: !!config.keyId,
                hasKeySecret: !!config.keySecret,
              },
            ),
            "Razorpay is not initialized - check environment variables",
          );
          console.error(
            `[PaymentsService] Razorpay not initialized for checkoutSessionId=${checkoutSessionId}`,
          );
          throw new BadRequestException(
            "Razorpay payment gateway is not configured. Please contact support.",
          );
        }

        const razorpay = this.getRazorpayInstance();

        // Log Razorpay instance status for diagnostics
        this.logger.debug(
          createLogContext(this.contextService, "createPaymentIntent", {
            checkoutSessionId,
            razorpayInitialized: this.isInitialized(),
            hasRazorpayInstance: !!razorpay,
          }),
          "Razorpay instance retrieved, proceeding with order creation",
        );
        console.log(
          `[PaymentsService] Razorpay instance ready for checkoutSessionId=${checkoutSessionId}`,
        );

        // Prepare Razorpay order options
        // CRITICAL: Amount MUST include payment fee (verified upstream in orders.service.ts)
        const options = {
          amount,
          currency,
          receipt: receipt || `checkout-${checkoutSessionId}`,
          payment_capture: 1, // Auto-capture by default
          notes: {
            checkout_session_id: checkoutSessionId,
            ...notes,
          },
        };

        // Log payment intent creation with amount breakdown for verification
        this.logger.info(
          {
            checkoutSessionId,
            amount,
            currency,
            paymentFee: notes?.payment_fee,
            paymentMethod: notes?.payment_method,
          },
          "Creating Razorpay payment intent with fee included",
        );

        try {
          // Create order in Razorpay
          // Use INFO level so it's visible in logs
          this.logger.info(
            createLogContext(this.contextService, "createPaymentIntent", {
              checkoutSessionId,
              amount,
              currency,
              receipt: options.receipt,
            }),
            "Calling Razorpay API to create order",
          );

          // Add console.log as fallback to ensure we see the call
          console.log(
            `[PaymentsService] Calling Razorpay API: amount=${amount}, currency=${currency}, receipt=${options.receipt}`,
          );
          console.log(`[PaymentsService] Razorpay instance:`, {
            initialized: this.isInitialized(),
            hasInstance: !!razorpay,
          });

          // Razorpay SDK now handles timeout at SDK level (configured during initialization)
          // The SDK will automatically timeout requests based on the timeout value set
          // This is more reliable than wrapping promises
          // Start the Razorpay API call - SDK handles timeout internally
          const razorpayOrder = await razorpay.orders.create(options);

          this.logger.info(
            createLogContext(this.contextService, "createPaymentIntent", {
              checkoutSessionId,
              razorpayOrderId: razorpayOrder.id,
              razorpayOrderAmount: razorpayOrder.amount,
            }),
            "Razorpay order created successfully",
          );

          console.log(
            `[PaymentsService] Razorpay order created: ${razorpayOrder.id}`,
          );

          // Verify Razorpay order ID exists
          if (!razorpayOrder.id || razorpayOrder.id === "") {
            this.logger.error(
              createErrorContext(
                this.contextService,
                "createPaymentIntent",
                new Error("Razorpay order ID is empty"),
                { checkoutSessionId, razorpayOrder },
              ),
              "Razorpay order created but ID is empty",
            );
            throw new BadRequestException(
              "Razorpay order creation returned empty order ID",
            );
          }

          // Verify Razorpay order amount matches expected amount
          if (razorpayOrder.amount !== amount) {
            this.logger.error(
              createErrorContext(
                this.contextService,
                "createPaymentIntent",
                new Error("Razorpay order amount mismatch"),
                {
                  checkoutSessionId,
                  expectedAmount: amount,
                  razorpayAmount: razorpayOrder.amount,
                },
              ),
              "Razorpay order amount mismatch - fee may not be included",
            );
            throw new BadRequestException(
              `Razorpay order amount mismatch: expected ${amount}, got ${razorpayOrder.amount}`,
            );
          }

          // Return payment intent
          const intent: PaymentIntent = {
            paymentProvider: "razorpay",
            paymentIntentId: razorpayOrder.id,
            status: PaymentIntentStatus.CREATED,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return intent;
        } catch (error) {
          // Log the full error details for debugging
          // Use console.error as fallback to ensure error is visible
          const errorDetails =
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : { type: typeof error, value: String(error) };

          // Determine error type for better diagnostics
          // Razorpay SDK errors can be timeout, network, or API errors
          const isTimeoutError =
            error instanceof Error &&
            (error.name === "TimeoutError" ||
              error.name === "ETIMEDOUT" ||
              error.message.includes("timed out") ||
              error.message.includes("timeout") ||
              (error as any).code === "ETIMEDOUT");
          const isNetworkError =
            error instanceof Error &&
            (error.message.includes("ECONNREFUSED") ||
              error.message.includes("ENOTFOUND") ||
              error.message.includes("ETIMEDOUT") ||
              error.message.includes("network") ||
              error.message.includes("ECONNRESET") ||
              (error as any).code === "ECONNREFUSED" ||
              (error as any).code === "ENOTFOUND" ||
              (error as any).code === "ECONNRESET");
          const isRazorpayApiError =
            error instanceof Error &&
            (error.message.includes("Razorpay") ||
              error.message.includes("razorpay") ||
              (error as any).statusCode !== undefined);

          console.error(
            `[PaymentsService] Razorpay API call failed:`,
            errorDetails,
            {
              checkoutSessionId,
              amount,
              currency,
              receipt: options.receipt,
              razorpayInitialized: this.isInitialized(),
              isTimeoutError,
              isNetworkError,
              isRazorpayApiError,
              errorType: error instanceof Error ? error.name : typeof error,
              errorCode: (error as any).code,
              statusCode: (error as any).statusCode,
            },
          );

          this.logger.error(
            createErrorContext(
              this.contextService,
              "createPaymentIntent",
              error,
              {
                checkoutSessionId,
                amount,
                currency,
                receipt: options.receipt,
                razorpayInitialized: this.isInitialized(),
                isTimeoutError,
                isNetworkError,
                isRazorpayApiError,
                errorType: error instanceof Error ? error.name : typeof error,
                errorCode: (error as any).code,
                statusCode: (error as any).statusCode,
              },
            ),
            `Failed to create Razorpay order${isTimeoutError ? " (timeout)" : isNetworkError ? " (network error)" : isRazorpayApiError ? " (Razorpay API error)" : ""}`,
          );

          // Provide more detailed error message with actionable information
          let errorMessage: string;
          if (isTimeoutError) {
            const timeoutMs = this.appConfigService.getRazorpayConfig().timeout;
            errorMessage = `Razorpay API call timed out after ${timeoutMs}ms. This may indicate a network issue, Razorpay service unavailability, or invalid API credentials. Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are correct and try again. CheckoutSessionId: ${checkoutSessionId}`;
          } else if (isNetworkError) {
            errorMessage = `Network error while connecting to Razorpay API. Please check your internet connection and ensure Razorpay services are accessible. CheckoutSessionId: ${checkoutSessionId}`;
          } else if (isRazorpayApiError) {
            // Razorpay API returned an error (e.g., invalid credentials, invalid amount, etc.)
            errorMessage = `Razorpay API error: ${error instanceof Error ? error.message : String(error)}. Please verify your Razorpay configuration and try again. CheckoutSessionId: ${checkoutSessionId}`;
          } else if (error instanceof Error) {
            errorMessage = `Failed to create Razorpay order: ${error.message}. CheckoutSessionId: ${checkoutSessionId}`;
          } else {
            errorMessage = `Unknown error occurred while creating Razorpay order. CheckoutSessionId: ${checkoutSessionId}`;
          }

          // Always throw to ensure error propagation
          throw new BadRequestException(errorMessage);
        }
      },
    );

    // Transition checkout state to PAYMENT_PENDING after successful creation
    try {
      await this.checkoutStore.transitionState(
        checkoutSessionId,
        CheckoutState.LOCKED,
        CheckoutState.PAYMENT_PENDING,
      );
    } catch (error) {
      // Log but don't fail - state transition failure shouldn't break payment intent creation
      // The payment intent is already created and stored
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToPaymentPending",
          error,
          { checkoutSessionId, paymentIntentId: paymentIntent.paymentIntentId },
        ),
        "Failed to transition checkout state to PAYMENT_PENDING",
      );
    }

    return paymentIntent;
  }

  /**
   * Create Razorpay order for payment (legacy method - for backward compatibility)
   * @param createRazorpayOrderDto - Order creation data
   * @returns Razorpay order response
   * @deprecated Use createPaymentIntent with checkoutSessionId instead
   */
  @Trace({ operation: "PaymentsService.createRazorpayOrder" })
  async createRazorpayOrder(
    createRazorpayOrderDto: CreateRazorpayOrderDto,
  ): Promise<RazorpayOrderResponseDto> {
    const razorpay = this.getRazorpayInstance();

    // Verify order exists in our system
    let order: typeof orders.$inferSelect | undefined;
    try {
      const orderResult = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, createRazorpayOrderDto.orderId))
        .limit(1);
      order = orderResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "PaymentsService.createRazorpayOrder.selectOrder",
          error,
          { orderId: createRazorpayOrderDto.orderId },
        ),
        "Failed to fetch order",
      );
      throw new NotFoundException(
        `Order with ID ${createRazorpayOrderDto.orderId} not found`,
      );
    }

    if (!order) {
      throw new NotFoundException(
        `Order with ID ${createRazorpayOrderDto.orderId} not found`,
      );
    }

    // Check if order already has a Razorpay order ID
    if (order.razorpayOrderId) {
      throw new BadRequestException(
        `Order ${order.orderNumber} already has a Razorpay order ID: ${order.razorpayOrderId}`,
      );
    }

    // Prepare Razorpay order options
    const options = {
      amount: createRazorpayOrderDto.amount, // Amount in paise
      currency: createRazorpayOrderDto.currency || "INR",
      receipt: createRazorpayOrderDto.receipt || order.orderNumber,
      payment_capture: createRazorpayOrderDto.paymentCapture ?? 1, // Auto-capture by default
      notes: {
        order_id: order.id,
        order_number: order.orderNumber,
        ...createRazorpayOrderDto.notes,
      },
    };

    try {
      // Create order in Razorpay
      const razorpayOrder = await razorpay.orders.create(options);

      // Update our order with Razorpay order ID
      try {
        await this.db
          .update(orders)
          .set({
            razorpayOrderId: razorpayOrder.id,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "PaymentsService.createRazorpayOrder.updateOrder",
            error,
            { orderId: order.id, razorpayOrderId: razorpayOrder.id },
          ),
          "Failed to update order with Razorpay order ID",
        );
        // Continue - payment intent is created, order update failure is logged
      }

      // Update checkout session with payment intent and transition state
      // Note: In the current flow, order is created before payment intent.
      // The session may be in ORDER_CREATED state. For now, we'll handle
      // payment states separately. Ideally, payment should happen before order creation.
      try {
        const sessionData = await this.checkoutStore.getSessionByOrderId(
          order.id,
        );
        if (sessionData) {
          const { sessionId, session } = sessionData;
          await this.checkoutStore.setPaymentIntent(
            sessionId,
            razorpayOrder.id,
          );
          // Only transition if in a state that allows PAYMENT_PENDING
          // Note: Current flow creates order first, so session may already be ORDER_CREATED
          // In ideal flow, payment happens before order creation
          if (session.state === CheckoutState.LOCKED) {
            await this.checkoutStore.transitionState(
              sessionId,
              CheckoutState.LOCKED,
              CheckoutState.PAYMENT_PENDING,
            );
          }
        }
      } catch (error) {
        // Log but don't fail payment creation if state update fails
        console.error(
          "Failed to update checkout session with payment intent:",
          error,
        );
      }

      return razorpayOrder as RazorpayOrderResponseDto;
    } catch (error) {
      throw new BadRequestException(
        `Failed to create Razorpay order: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Verify payment signature
   * @param verifyPaymentDto - Payment verification data
   * @returns Verification result
   */
  @Trace({ operation: "PaymentsService.verifyPayment" })
  async verifyPayment(
    verifyPaymentDto: VerifyPaymentDto,
  ): Promise<{ verified: boolean; message: string }> {
    this.getRazorpayInstance(); // Ensure Razorpay is initialized
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      throw new BadRequestException("Razorpay key secret is not configured");
    }

    // Generate signature
    const text =
      verifyPaymentDto.razorpay_order_id +
      "|" +
      verifyPaymentDto.razorpay_payment_id;
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(text)
      .digest("hex");

    // Compare signatures
    const isValid = generatedSignature === verifyPaymentDto.razorpay_signature;

    return {
      verified: isValid,
      message: isValid
        ? "Payment signature verified successfully"
        : "Payment signature verification failed",
    };
  }

  /**
   * Get Razorpay payment details
   * @param paymentId - Razorpay payment ID
   * @returns Payment details
   */
  async getPaymentDetails(paymentId: string) {
    const razorpay = this.getRazorpayInstance();

    try {
      const payment = await razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      throw new NotFoundException(
        `Payment with ID ${paymentId} not found: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get Razorpay order details
   * @param orderId - Razorpay order ID
   * @returns Order details
   */
  @Trace({ operation: "PaymentsService.getRazorpayOrderDetails" })
  async getRazorpayOrderDetails(orderId: string) {
    const razorpay = this.getRazorpayInstance();

    try {
      const razorpayOrder = await razorpay.orders.fetch(orderId);
      return razorpayOrder;
    } catch (error) {
      throw new NotFoundException(
        `Razorpay order with ID ${orderId} not found: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Handle Razorpay webhook event
   * @param webhookEvent - Webhook event from Razorpay
   * @param signature - Webhook signature for verification
   * @returns Processing result
   */
  @Trace({ operation: "PaymentsService.handleWebhook" })
  async handleWebhook(
    webhookEvent: RazorpayWebhookEventDto,
    signature: string,
  ): Promise<{ processed: boolean; message: string }> {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new BadRequestException(
        "Razorpay webhook secret is not configured",
      );
    }

    // Verify webhook signature
    const text = JSON.stringify(webhookEvent);
    const generatedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(text)
      .digest("hex");

    if (generatedSignature !== signature) {
      throw new BadRequestException("Invalid webhook signature");
    }

    // Process webhook event based on event type
    const eventName = webhookEvent.event;

    switch (eventName) {
      case "payment.captured":
        await this.handlePaymentCaptured(webhookEvent);
        break;
      case "payment.failed":
        await this.handlePaymentFailed(webhookEvent);
        break;
      case "payment.authorized":
        await this.handlePaymentAuthorized(webhookEvent);
        break;
      case "order.paid":
        await this.handleOrderPaid(webhookEvent);
        break;
      default:
        // Log unhandled events but don't fail
        return {
          processed: false,
          message: `Event ${eventName} is not handled`,
        };
    }

    return {
      processed: true,
      message: `Event ${eventName} processed successfully`,
    };
  }

  /**
   * Handle payment captured event
   * Creates order only after payment confirmation (webhook-driven)
   */
  private async handlePaymentCaptured(
    webhookEvent: RazorpayWebhookEventDto,
  ): Promise<void> {
    const paymentEntity = webhookEvent.payload.payment?.entity;
    if (!paymentEntity) {
      this.logger.warn(
        createLogContext(this.contextService, "handlePaymentCaptured", {
          event: webhookEvent.event,
          accountId: webhookEvent.account_id,
        }),
        "Payment entity not found in payment.captured webhook",
      );
      return;
    }

    const paymentIntentId = paymentEntity.order_id; // Razorpay order ID

    // Find checkout session via payment intent lookup
    let checkoutSessionId: string | null = null;

    // Method 1: Try to get checkoutSessionId from Razorpay order notes
    try {
      const razorpayOrder = await this.getRazorpayOrderDetails(paymentIntentId);
      const sessionIdFromNotes = razorpayOrder.notes?.checkout_session_id;
      checkoutSessionId =
        typeof sessionIdFromNotes === "string" ? sessionIdFromNotes : null;
    } catch (error) {
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "getRazorpayOrderDetails",
          error,
          { paymentIntentId },
        ),
        "Failed to fetch Razorpay order details",
      );
    }

    // Method 2: Fallback to reverse lookup if not in notes
    if (!checkoutSessionId) {
      try {
        const paymentIntent =
          await this.checkoutStore.getPaymentIntentByPaymentId(paymentIntentId);
        if (paymentIntent) {
          // Extract checkoutSessionId from payment intent (we need to get it from the key)
          // Since we don't store checkoutSessionId in PaymentIntent, use reverse lookup
          const reverseKey = `payment:intent:by-id:${paymentIntentId}`;
          checkoutSessionId = await this.checkoutStore.get<string>(reverseKey);
        }
      } catch (error) {
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "getCheckoutSessionIdReverseLookup",
            error,
            { paymentIntentId },
          ),
          "Failed to get checkoutSessionId via reverse lookup",
        );
      }
    }

    // If we still don't have checkoutSessionId, check if order already exists (legacy flow)
    if (!checkoutSessionId) {
      const existingOrderId = await this.checkoutStore.getOrderByPaymentIntent(
        "razorpay",
        paymentIntentId,
      );
      if (existingOrderId) {
        // Order already exists - this is a duplicate webhook or legacy order
        this.logger.debug(
          createLogContext(this.contextService, "handlePaymentCaptured", {
            paymentIntentId,
            orderId: existingOrderId,
          }),
          "Order already exists, processing payment record only",
        );
        await this.createPaymentRecord(paymentEntity, existingOrderId);
        return;
      }
    }

    if (!checkoutSessionId) {
      this.logger.error(
        createLogContext(this.contextService, "handlePaymentCaptured", {
          paymentIntentId,
          event: webhookEvent.event,
          accountId: webhookEvent.account_id,
        }),
        "Checkout session ID not found for payment.captured webhook, cannot create order",
      );
      return;
    }

    // Get checkout session to check state (late event handling)
    const session = await this.checkoutStore.getSession(checkoutSessionId);
    if (!session) {
      this.logger.error(
        createLogContext(this.contextService, "handlePaymentCaptured", {
          checkoutSessionId,
          paymentIntentId,
        }),
        "Checkout session not found",
      );
      return;
    }

    // Late event handling: ignore if checkout is already COMPLETED
    if (session.state === CheckoutState.COMPLETED) {
      this.logger.info(
        createLogContext(this.contextService, "handlePaymentCaptured", {
          checkoutSessionId,
          paymentIntentId,
          state: session.state,
        }),
        "Ignoring late payment.captured webhook for completed checkout",
      );
      // Still create payment record if order exists
      const existingOrderId = await this.checkoutStore.getOrderByPaymentIntent(
        "razorpay",
        paymentIntentId,
      );
      if (existingOrderId) {
        await this.createPaymentRecord(paymentEntity, existingOrderId);
      }
      return;
    }

    // Ignore if checkout is FAILED
    if (session.state === CheckoutState.FAILED) {
      this.logger.info(
        createLogContext(this.contextService, "handlePaymentCaptured", {
          checkoutSessionId,
          paymentIntentId,
          state: session.state,
        }),
        "Ignoring payment.captured webhook for failed checkout",
      );
      return;
    }

    // Update payment intent status and transition to PAYMENT_CONFIRMED
    try {
      await this.checkoutStore.updatePaymentIntentStatus(
        checkoutSessionId,
        PaymentIntentStatus.CONFIRMED,
      );

      // Transition checkout session to PAYMENT_CONFIRMED
      if (session.state === CheckoutState.PAYMENT_PENDING) {
        try {
          await this.checkoutStore.transitionState(
            checkoutSessionId,
            CheckoutState.PAYMENT_PENDING,
            CheckoutState.PAYMENT_CONFIRMED,
          );
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "transitionToPaymentConfirmed",
              error,
              { checkoutSessionId, paymentIntentId },
            ),
            "Failed to transition checkout session to PAYMENT_CONFIRMED",
          );
          // Continue - will retry state transition in finalizeOrderFromPayment
        }
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "updatePaymentIntentStatus",
          error,
          { checkoutSessionId, paymentIntentId },
        ),
        "Failed to update payment intent status",
      );
      // Continue - payment is confirmed, we can still create order
    }

    // Acquire checkout lock before order creation (prevents concurrent webhook processing)
    const lockAcquired = await this.checkoutStore.acquireCheckoutLock(
      session.cartId,
    );
    if (!lockAcquired) {
      // Lock already held - another webhook worker is processing
      // Check if order was created by the other worker
      const existingOrderId = await this.checkoutStore.getOrderByPaymentIntent(
        "razorpay",
        paymentIntentId,
      );
      if (existingOrderId) {
        this.logger.debug(
          createLogContext(this.contextService, "handlePaymentCaptured", {
            paymentIntentId,
            orderId: existingOrderId,
            checkoutSessionId,
          }),
          "Order already being created by another worker",
        );
        await this.createPaymentRecord(paymentEntity, existingOrderId);
        return;
      }
      // Lock held but no order - wait a bit and retry
      await new Promise((resolve) => setTimeout(resolve, 200));
      const retryOrderId = await this.checkoutStore.getOrderByPaymentIntent(
        "razorpay",
        paymentIntentId,
      );
      if (retryOrderId) {
        await this.createPaymentRecord(paymentEntity, retryOrderId);
        return;
      }
      this.logger.warn(
        createLogContext(this.contextService, "handlePaymentCaptured", {
          paymentIntentId,
          checkoutSessionId,
          cartId: session.cartId,
        }),
        "Checkout lock held but order not found, another worker may be processing",
      );
      return;
    }

    try {
      // Create order from payment confirmation (webhook-driven)
      const order = await this.ordersService.finalizeOrderFromPayment(
        checkoutSessionId,
        paymentIntentId,
        "razorpay",
      );

      // Create payment record
      await this.createPaymentRecord(paymentEntity, order.id);

      this.logger.info(
        createLogContext(this.contextService, "handlePaymentCaptured", {
          orderId: order.id,
          paymentIntentId,
          checkoutSessionId,
        }),
        "Order created from payment confirmation",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "finalizeOrderFromPayment",
          error,
          { paymentIntentId, checkoutSessionId, cartId: session.cartId },
        ),
        "Failed to finalize order from payment",
      );
      throw error;
    } finally {
      // Release checkout lock
      try {
        await this.checkoutStore.releaseCheckoutLock(session.cartId);
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "releaseCheckoutLock",
            error,
            { cartId: session.cartId, checkoutSessionId },
          ),
          "Failed to release checkout lock",
        );
      }
    }
  }

  /**
   * Create or update payment record (idempotent)
   */
  private async createPaymentRecord(
    paymentEntity: {
      id: string;
      order_id: string;
      amount: number;
      method: string;
    },
    orderId: string,
  ): Promise<void> {
    // Check if payment already exists (idempotent webhook processing)
    let existingPayment: typeof payments.$inferSelect | undefined;
    try {
      const paymentResult = await this.db
        .select()
        .from(payments)
        .where(eq(payments.razorpayPaymentId, paymentEntity.id))
        .limit(1);
      existingPayment = paymentResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "PaymentsService.createPaymentRecord.selectPayment",
          error,
          { razorpayPaymentId: paymentEntity.id, orderId },
        ),
        "Failed to check existing payment",
      );
      // Continue - will try to create new payment record
    }

    if (existingPayment) {
      // Update existing payment (idempotent)
      try {
        await this.db
          .update(payments)
          .set({
            status: "captured",
            updatedAt: new Date(),
          })
          .where(eq(payments.id, existingPayment.id));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "PaymentsService.createPaymentRecord.updatePayment",
            error,
            { paymentId: existingPayment.id },
          ),
          "Failed to update payment record",
        );
        throw error;
      }
    } else {
      // Create new payment record
      try {
        await this.db.insert(payments).values({
          orderId,
          razorpayPaymentId: paymentEntity.id,
          razorpayOrderId: paymentEntity.order_id,
          amount: paymentEntity.amount / 100, // Convert from paise to rupees
          status: "captured",
          method: this.mapRazorpayMethodToEnum(paymentEntity.method),
        });
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "PaymentsService.createPaymentRecord.insertPayment",
            error,
            { orderId, razorpayPaymentId: paymentEntity.id },
          ),
          "Failed to create payment record",
        );
        throw error;
      }
    }

    // Update order status to confirmed if payment is captured
    let order: typeof orders.$inferSelect | undefined;
    try {
      const orderResult = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      order = orderResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "PaymentsService.createPaymentRecord.selectOrder",
          error,
          { orderId },
        ),
        "Failed to fetch order for status update",
      );
      // Don't throw - payment record is created, order status update can fail
      return;
    }

    if (order && order.status === "pending") {
      try {
        await this.db
          .update(orders)
          .set({
            status: "confirmed",
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "PaymentsService.createPaymentRecord.updateOrderStatus",
            error,
            { orderId },
          ),
          "Failed to update order status to confirmed",
        );
        // Don't throw - payment is captured, status update failure is logged
      }
    }
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(
    webhookEvent: RazorpayWebhookEventDto,
  ): Promise<void> {
    const paymentEntity = webhookEvent.payload.payment?.entity;
    if (!paymentEntity) {
      return;
    }

    const paymentIntentId = paymentEntity.order_id; // Razorpay order ID

    // Find checkout session via payment intent lookup
    let checkoutSessionId: string | null = null;

    // Method 1: Try to get checkoutSessionId from Razorpay order notes
    try {
      const razorpayOrder = await this.getRazorpayOrderDetails(paymentIntentId);
      const sessionIdFromNotes = razorpayOrder.notes?.checkout_session_id;
      checkoutSessionId =
        typeof sessionIdFromNotes === "string" ? sessionIdFromNotes : null;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch Razorpay order details for paymentIntentId=${paymentIntentId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Method 2: Fallback to reverse lookup if not in notes
    if (!checkoutSessionId) {
      try {
        const reverseKey = `payment:intent:by-id:${paymentIntentId}`;
        checkoutSessionId = await this.checkoutStore.get<string>(reverseKey);
      } catch (error) {
        this.logger.warn(
          `Failed to get checkoutSessionId via reverse lookup for paymentIntentId=${paymentIntentId}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    // Update payment intent status if we found checkoutSessionId
    if (checkoutSessionId) {
      try {
        const paymentIntent =
          await this.checkoutStore.getPaymentIntent(checkoutSessionId);
        if (paymentIntent) {
          // Update payment intent status atomically (idempotent)
          await this.checkoutStore.updatePaymentIntentStatus(
            checkoutSessionId,
            PaymentIntentStatus.FAILED,
          );

          // Transition checkout session to FAILED if in PAYMENT_PENDING
          try {
            const session =
              await this.checkoutStore.getSession(checkoutSessionId);
            if (session && session.state === CheckoutState.PAYMENT_PENDING) {
              await this.checkoutStore.failSession(checkoutSessionId);
            }
          } catch (error) {
            this.logger.error(
              createErrorContext(
                this.contextService,
                "failCheckoutSession",
                error,
                { checkoutSessionId, paymentIntentId },
              ),
              "Failed to fail checkout session",
            );
          }
        }
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "updatePaymentIntentStatus",
            error,
            { checkoutSessionId, paymentIntentId },
          ),
          "Failed to update payment intent status",
        );
      }
    }

    // Find order by Razorpay order ID
    let order: typeof orders.$inferSelect | undefined;
    try {
      const orderResult = await this.db
        .select()
        .from(orders)
        .where(eq(orders.razorpayOrderId, paymentIntentId))
        .limit(1);
      order = orderResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "PaymentsService.handlePaymentFailed.selectOrder",
          error,
          { paymentIntentId },
        ),
        "Failed to find order by Razorpay order ID",
      );
      // Order not found, but payment intent was updated
      return;
    }

    if (!order) {
      // Order not found, but payment intent was updated
      return;
    }

    // Transition checkout session to FAILED (legacy fallback)
    try {
      const sessionData = await this.checkoutStore.getSessionByOrderId(
        order.id,
      );
      if (sessionData && !checkoutSessionId) {
        // Only use legacy flow if we didn't already update via payment intent
        await this.checkoutStore.failSession(sessionData.sessionId);
      }
    } catch (error) {
      // Log but don't fail webhook processing if state transition fails
      this.logger.error(
        createErrorContext(this.contextService, "transitionToFailed", error, {
          orderId: order.id,
          paymentIntentId,
        }),
        "Failed to transition checkout session to FAILED",
      );
    }

    // Check if payment exists
    let existingPayment: typeof payments.$inferSelect | undefined;
    try {
      const paymentResult = await this.db
        .select()
        .from(payments)
        .where(eq(payments.razorpayPaymentId, paymentEntity.id))
        .limit(1);
      existingPayment = paymentResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "PaymentsService.handlePaymentFailed.selectPayment",
          error,
          { razorpayPaymentId: paymentEntity.id, orderId: order.id },
        ),
        "Failed to check existing payment",
      );
      // Continue - will try to create new payment record
    }

    if (existingPayment) {
      // Update payment status
      try {
        await this.db
          .update(payments)
          .set({
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(payments.id, existingPayment.id));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "PaymentsService.handlePaymentFailed.updatePayment",
            error,
            { paymentId: existingPayment.id },
          ),
          "Failed to update payment status to failed",
        );
        // Don't throw - log and continue
      }
    } else {
      // Create payment record with failed status
      try {
        await this.db.insert(payments).values({
          orderId: order.id,
          razorpayPaymentId: paymentEntity.id,
          razorpayOrderId: paymentEntity.order_id,
          amount: paymentEntity.amount / 100,
          status: "failed",
          method: this.mapRazorpayMethodToEnum(paymentEntity.method),
        });
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "PaymentsService.handlePaymentFailed.insertPayment",
            error,
            { orderId: order.id, razorpayPaymentId: paymentEntity.id },
          ),
          "Failed to create payment record with failed status",
        );
        // Don't throw - webhook processing should continue
      }
    }
  }

  /**
   * Handle payment authorized event
   */
  private async handlePaymentAuthorized(
    webhookEvent: RazorpayWebhookEventDto,
  ): Promise<void> {
    const paymentEntity = webhookEvent.payload.payment?.entity;
    if (!paymentEntity) {
      return;
    }

    // Find order by Razorpay order ID
    let order: typeof orders.$inferSelect | undefined;
    try {
      const orderResult = await this.db
        .select()
        .from(orders)
        .where(eq(orders.razorpayOrderId, paymentEntity.order_id))
        .limit(1);
      order = orderResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "PaymentsService.handlePaymentAuthorized.selectOrder",
          error,
          { razorpayOrderId: paymentEntity.order_id },
        ),
        "Failed to find order by Razorpay order ID",
      );
      return;
    }

    if (!order) {
      return;
    }

    // Create or update payment record with processing status
    let existingPayment: typeof payments.$inferSelect | undefined;
    try {
      const paymentResult = await this.db
        .select()
        .from(payments)
        .where(eq(payments.razorpayPaymentId, paymentEntity.id))
        .limit(1);
      existingPayment = paymentResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "PaymentsService.handlePaymentAuthorized.selectPayment",
          error,
          { razorpayPaymentId: paymentEntity.id, orderId: order.id },
        ),
        "Failed to check existing payment",
      );
      // Continue - will try to create new payment record
    }

    if (existingPayment) {
      try {
        await this.db
          .update(payments)
          .set({
            status: "processing",
            updatedAt: new Date(),
          })
          .where(eq(payments.id, existingPayment.id));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "PaymentsService.handlePaymentAuthorized.updatePayment",
            error,
            { paymentId: existingPayment.id },
          ),
          "Failed to update payment status to processing",
        );
        // Don't throw - log and continue
      }
    } else {
      try {
        await this.db.insert(payments).values({
          orderId: order.id,
          razorpayPaymentId: paymentEntity.id,
          razorpayOrderId: paymentEntity.order_id,
          amount: paymentEntity.amount / 100,
          status: "processing",
          method: this.mapRazorpayMethodToEnum(paymentEntity.method),
        });
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "PaymentsService.handlePaymentAuthorized.insertPayment",
            error,
            { orderId: order.id, razorpayPaymentId: paymentEntity.id },
          ),
          "Failed to create payment record with processing status",
        );
        // Don't throw - webhook processing should continue
      }
    }
  }

  /**
   * Handle order paid event
   */
  private async handleOrderPaid(
    webhookEvent: RazorpayWebhookEventDto,
  ): Promise<void> {
    const orderEntity = webhookEvent.payload.order?.entity;
    if (!orderEntity) {
      return;
    }

    // Find order by Razorpay order ID
    let order: typeof orders.$inferSelect | undefined;
    try {
      const orderResult = await this.db
        .select()
        .from(orders)
        .where(eq(orders.razorpayOrderId, orderEntity.id))
        .limit(1);
      order = orderResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "PaymentsService.handleOrderPaid.selectOrder",
          error,
          { razorpayOrderId: orderEntity.id },
        ),
        "Failed to find order by Razorpay order ID",
      );
      return;
    }

    if (!order) {
      return;
    }

    // Update order status to confirmed
    if (order.status === "pending") {
      await this.db
        .update(orders)
        .set({
          status: "confirmed",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));
    }
  }

  /**
   * Map Razorpay payment method to our enum
   */
  private mapRazorpayMethodToEnum(
    razorpayMethod: string,
  ): "razorpay" | "cod" | "upi" | "card" | "netbanking" | "wallet" {
    const methodMap: Record<
      string,
      "razorpay" | "cod" | "upi" | "card" | "netbanking" | "wallet"
    > = {
      card: "card",
      upi: "upi",
      netbanking: "netbanking",
      wallet: "wallet",
      cod: "cod",
    };

    return methodMap[razorpayMethod.toLowerCase()] || "razorpay";
  }
}
