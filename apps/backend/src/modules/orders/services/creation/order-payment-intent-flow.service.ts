import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { inArray, products, productVariants } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { PAISE_PER_RUPEE } from "../../../../common/constants/currency.constants";
import {
  COD_PAYMENT_METHOD,
  isCodPayment,
} from "../../../../common/constants/orders.constants";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import type { Database } from "../../../../modules/database/db";
import { DB_TOKEN } from "../../../database/database.module";
import { PaymentFeeBreakdownDto } from "../../../payments/dto/payment-charge.dto";
import { CheckoutMetadata } from "../../../redis-store/dto/checkout-metadata.dto";
import { PaymentIntentStatus } from "../../../redis-store/dto/payment-intent.dto";
import { CheckoutStore } from "../../../redis-store/stores/checkout-store";
import { CreateOrderDto } from "../../dto/create-order.dto";
import { PaymentIntentResponseDto } from "../../dto/payment-intent-response.dto";
import { OrderCalculationService } from "../calculation/order-calculation.service";
import { OrderCartDataService } from "../cart/order-cart-data.service";
import { OrderCartProcessingService } from "../cart/order-cart-processing.service";
import { OrderCheckoutOrchestrationService } from "../checkout/order-checkout-orchestration.service";
import { OrderCheckoutSessionService } from "../checkout/order-checkout-session.service";
import { OrderMetadataService } from "../checkout/order-metadata.service";
import { OrderDiscountEngineService } from "../discount/order-discount-engine.service";
import { OrderPaymentIntentService } from "../payment/order-payment-intent.service";
import { OrderPricingEngineService } from "../pricing/order-pricing-engine.service";
import { OrderValidationService } from "../validation/order-validation.service";
import { OrderCodFlowService } from "./order-cod-flow.service";

/**
 * Service responsible for orchestrating payment intent creation flow
 * Handles checkout setup, cart processing, pricing/discount engines, and payment intent creation
 */
@Injectable()
export class OrderPaymentIntentFlowService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly checkoutStore: CheckoutStore,
    private readonly validationService: OrderValidationService,
    private readonly checkoutOrchestrationService: OrderCheckoutOrchestrationService,
    private readonly cartDataService: OrderCartDataService,
    private readonly checkoutSessionService: OrderCheckoutSessionService,
    private readonly cartProcessingService: OrderCartProcessingService,
    private readonly calculationService: OrderCalculationService,
    private readonly pricingEngineService: OrderPricingEngineService,
    private readonly discountEngineService: OrderDiscountEngineService,
    private readonly metadataService: OrderMetadataService,
    private readonly paymentIntentService: OrderPaymentIntentService,
    private readonly codFlowService: OrderCodFlowService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Create payment intent for checkout
   * Orders are now created only after payment confirmation via webhook
   * Supports both authenticated and guest checkout
   */
  @Trace({ operation: "OrderPaymentIntentFlowService.createPaymentIntent" })
  async createPaymentIntent(
    userId: string | null,
    createOrderDto: CreateOrderDto,
    sessionId?: string | null,
  ): Promise<PaymentIntentResponseDto> {
    // Note: Idempotency is now handled at payment intent level (createOrGetPaymentIntent)
    // No need for request-level idempotency here since payment intent creation is idempotent
    let lockAcquired = false;
    let cartId: string | null = null;
    let checkoutSessionId: string | null = null;
    let customerId: string;
    let shippingAddressId: string;
    let billingAddressId: string;
    let actualUserId: string | null = userId;
    let shippingAddress: { state: string } | null = null;

    try {
      // Orchestrate checkout setup (customer, addresses, cart)
      const checkoutSetup =
        await this.checkoutOrchestrationService.orchestrateCheckout(
          userId,
          createOrderDto,
          sessionId,
        );
      customerId = checkoutSetup.customerId;
      shippingAddressId = checkoutSetup.shippingAddressId;
      billingAddressId = checkoutSetup.billingAddressId;
      cartId = checkoutSetup.cartId;
      actualUserId = checkoutSetup.actualUserId;
      shippingAddress = checkoutSetup.shippingAddress;

      // Get cart object for later use (discount code, items, etc.)
      const cart = await this.cartDataService.getCartForOrder(cartId);

      // Get or create checkout session
      const sessionResult =
        await this.checkoutSessionService.getOrCreateSession(
          cartId,
          createOrderDto.checkoutSessionId || null,
        );
      checkoutSessionId = sessionResult.sessionId;
      lockAcquired = sessionResult.lockAcquired;

      // Get discount code from cart
      const discountCode =
        "discountCode" in cart ? (cart.discountCode as string | null) : null;

      // Extract and process cart items
      const cartItemIds = cart.items.map((item) => item.id);
      const allCartItems =
        await this.cartProcessingService.extractCartItems(cartItemIds);
      const { bundleItems: bundleCartItems, variantItems: variantCartItems } =
        this.cartProcessingService.separateBundleAndVariantItems(allCartItems);
      const variantItemIds = variantCartItems.map((i) => i.id);
      const cartItemsWithVariants =
        await this.cartProcessingService.fetchCartItemProductData(
          variantItemIds,
        );

      // Calculate totals
      const sellerState = this.validationService.getSellerState();
      if (!shippingAddress) {
        throw new BadRequestException("Shipping address not found");
      }
      const buyerState = shippingAddress.state;

      const totals = await this.calculationService.calculateOrderTotals(
        cartItemsWithVariants.map((item) => ({
          price: item.price,
          quantity: item.quantity,
          productGstRate: item.productGstRate,
        })),
        bundleCartItems.map((item) => ({
          price: item.price,
          quantity: item.quantity,
          productVariantId: item.productVariantId,
        })),
        sellerState,
        buyerState,
      );
      const { subtotal, totalGstAmount } = totals;
      const shippingCost = createOrderDto.shippingCost || 0;

      // Flatten bundles for pricing/discount engines
      const bundleProcessingResult =
        await this.cartProcessingService.processBundleItems(bundleCartItems);
      const { bundleVariantMapping, flattenedBundleVariants } =
        bundleProcessingResult;

      // Get product IDs from variants (needed for both pricing and discount engines)
      const variantIds = [
        ...cartItemsWithVariants.map((item) => item.productVariantId),
        ...flattenedBundleVariants.map((v) => v.variantId),
      ];
      const variantProductMap = await this.db
        .select({
          variantId: productVariants.id,
          productId: productVariants.productId,
        })
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds));

      const productIds = Array.from(
        new Set(variantProductMap.map((v) => v.productId)),
      );

      // Get product details
      const productDetails = await this.db
        .select({
          productId: products.id,
          categoryId: products.categoryId,
        })
        .from(products)
        .where(inArray(products.id, productIds));

      const variantToProductForPricing = new Map(
        variantProductMap.map((v) => [v.variantId, v.productId]),
      );
      const productMapForPricing = new Map(
        productDetails.map((p) => [p.productId, p]),
      );

      // STEP 1: Run pricing engine to get effective prices (before discounts)
      const pricingResult = await this.pricingEngineService.runPricingEngine(
        checkoutSessionId,
        cartId,
        customerId,
        cartItemsWithVariants,
        bundleCartItems,
        flattenedBundleVariants,
        variantToProductForPricing,
        productMapForPricing,
        subtotal,
      );
      const { pricingSnapshot, effectiveSubtotal } = pricingResult;

      // STEP 2: Use discount engine to calculate discount and generate snapshot
      // Discounts apply to effective prices from pricing engine
      const { discountAmount, discountSnapshot } =
        await this.discountEngineService.applyDiscounts(
          cart.id,
          checkoutSessionId,
          effectiveSubtotal,
          customerId,
          userId,
          discountCode,
          createOrderDto.shippingCost || 0,
          cartItemsWithVariants,
          bundleCartItems,
          bundleVariantMapping,
          flattenedBundleVariants,
          variantProductMap,
          productDetails,
        );

      // Calculate total after discount (discount applies to effective subtotal before GST)
      const subtotalAfterDiscount = Math.max(
        0,
        effectiveSubtotal - discountAmount,
      );

      // Get payment method and fee from checkout metadata
      let paymentFee = 0;
      let paymentMethod: string | undefined;
      let paymentFeeBreakdown: PaymentFeeBreakdownDto | undefined;

      if (checkoutSessionId) {
        const existingMetadata =
          await this.checkoutStore.getCheckoutMetadata(checkoutSessionId);
        // Get payment method first (required for COD detection)
        if (existingMetadata?.paymentMethod) {
          paymentMethod = existingMetadata.paymentMethod;
        }
        // Get payment fee if available
        if (existingMetadata?.paymentFee !== undefined) {
          paymentFee = existingMetadata.paymentFee; // Already in paise
          paymentFeeBreakdown = existingMetadata.paymentFeeBreakdown;
        }
      }

      // Comprehensive COD detection with debug logging
      const isCod = isCodPayment(paymentMethod);
      this.logger.debug(
        createLogContext(this.contextService, "codDetection", {
          checkoutSessionId,
          cartId,
          paymentMethod,
          normalizedMethod: paymentMethod
            ? paymentMethod.trim().toLowerCase()
            : null,
          expectedCOD: COD_PAYMENT_METHOD,
          isCOD: isCod,
          metadataExists: !!checkoutSessionId,
          paymentMethodType: typeof paymentMethod,
        }),
        "COD detection check",
      );

      // Check if payment method is COD - if so, create order directly without payment intent
      // This check must happen BEFORE storing metadata and creating payment intent
      if (isCod) {
        this.logger.info(
          createLogContext(this.contextService, "createCodOrder", {
            checkoutSessionId,
            cartId,
            paymentMethod,
          }),
          "COD payment method detected, creating order directly",
        );

        // Ensure checkout metadata is stored before creating COD order
        if (!checkoutSessionId) {
          throw new ConflictException(
            "Checkout session is required for COD order creation",
          );
        }

        const checkoutMetadata: CheckoutMetadata = {
          customerId,
          userId: actualUserId,
          shippingAddressId,
          billingAddressId,
          shippingCost: createOrderDto.shippingCost || 0,
          discountSnapshot,
          pricingSnapshot,
          paymentMethod,
          paymentFee,
          paymentFeeBreakdown,
          createdAt: new Date().toISOString(),
        };

        try {
          await this.checkoutStore.storeCheckoutMetadata(
            checkoutSessionId,
            checkoutMetadata,
          );
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "storeCheckoutMetadata",
              error,
              { checkoutSessionId },
            ),
            "Failed to store checkout metadata for COD order",
          );
          throw new ConflictException(
            "Failed to store checkout metadata - cannot proceed with COD order creation",
          );
        }

        // Create COD order directly
        const codOrder = await this.codFlowService.createCodOrder(
          checkoutSessionId,
          userId,
          createOrderDto,
          sessionId || null,
        );

        // Return response with order details (no payment intent for COD)
        return {
          paymentIntent: {
            paymentProvider: "cod",
            paymentIntentId: `cod-${codOrder.id}`, // Placeholder ID for COD
            status: PaymentIntentStatus.CREATED,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          checkoutSessionId,
          message: "COD order created successfully",
          orderId: codOrder.id, // Include order ID for COD orders
        };
      }

      // Include payment fee in total (convert from paise to rupees)
      const total =
        subtotalAfterDiscount +
        totalGstAmount +
        shippingCost +
        paymentFee / PAISE_PER_RUPEE;

      // Verify payment intent amount calculation includes fee
      const expectedAmountInPaise = Math.round(total * PAISE_PER_RUPEE);
      const expectedComponents = {
        subtotalAfterDiscount: Math.round(
          subtotalAfterDiscount * PAISE_PER_RUPEE,
        ),
        totalGstAmount: Math.round(totalGstAmount * PAISE_PER_RUPEE),
        shippingCost: Math.round(shippingCost * PAISE_PER_RUPEE),
        paymentFee,
        total: expectedAmountInPaise,
      };

      this.logger.debug(
        createLogContext(
          this.contextService,
          "paymentIntentAmountVerification",
          {
            checkoutSessionId,
            expectedAmountInPaise,
            components: expectedComponents,
            paymentMethod,
          },
        ),
        "Payment intent amount verification - fee included in total",
      );

      // Store checkout metadata for order creation (will be used in webhook handler)
      if (!checkoutSessionId) {
        throw new ConflictException(
          "Checkout session is required for payment intent creation",
        );
      }

      // Store checkout metadata
      await this.metadataService.createAndStoreMetadata(checkoutSessionId, {
        customerId,
        userId: actualUserId,
        shippingAddressId,
        billingAddressId,
        shippingCost: createOrderDto.shippingCost || 0,
        discountSnapshot,
        pricingSnapshot,
        paymentMethod,
        paymentFee,
        paymentFeeBreakdown,
      });

      // Create payment intent using OrderPaymentIntentService
      const paymentIntent = await this.paymentIntentService.createPaymentIntent(
        checkoutSessionId,
        total,
        subtotalAfterDiscount,
        totalGstAmount,
        shippingCost,
        paymentFee,
        paymentMethod,
        effectiveSubtotal,
        discountSnapshot,
        pricingSnapshot,
      );

      // Release checkout lock - order creation will happen in webhook handler
      // Lock will be re-acquired in webhook handler before order creation
      if (lockAcquired && cartId) {
        await this.checkoutSessionService.releaseLock(cartId);
      }

      // Return payment intent + session ID
      return {
        paymentIntent: paymentIntent || null,
        checkoutSessionId,
        message: "Payment intent created. Redirect user to payment gateway.",
      };
    } catch (error) {
      // Transition session to FAILED state on error
      if (checkoutSessionId) {
        await this.checkoutSessionService.failSession(checkoutSessionId);
      }

      // Release checkout lock only if it was acquired
      if (lockAcquired && cartId) {
        await this.checkoutSessionService.releaseLock(cartId);
      }

      throw error;
    }
  }
}
