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

      // Validate cart has items (defensive check)
      if (!cart.items || cart.items.length === 0) {
        throw new BadRequestException("Cart is empty or items are missing");
      }

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

      if (!allCartItems || !Array.isArray(allCartItems)) {
        throw new BadRequestException("Failed to extract cart items");
      }

      if (allCartItems.length === 0) {
        throw new BadRequestException("Cart is empty - no items to process");
      }

      let bundleCartItems: Array<{
        id: string;
        productVariantId: string;
        quantity: number;
        price: number;
        metadata: unknown;
      }> = [];
      let variantCartItems: Array<{
        id: string;
        productVariantId: string;
        quantity: number;
        price: number;
        metadata: unknown;
      }> = [];

      try {
        const separationResult =
          this.cartProcessingService.separateBundleAndVariantItems(
            allCartItems,
          );

        if (!separationResult || typeof separationResult !== "object") {
          throw new Error("Separation result is invalid");
        }

        bundleCartItems = Array.isArray(separationResult.bundleItems)
          ? separationResult.bundleItems
          : [];
        variantCartItems = Array.isArray(separationResult.variantItems)
          ? separationResult.variantItems
          : [];
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "separateBundleAndVariantItems",
            error instanceof Error ? error : new Error(String(error)),
            { cartId, allCartItemsCount: allCartItems.length },
          ),
          "Failed to separate cart items, treating all as variant items",
        );
        // Fallback: treat all items as variant items
        variantCartItems = allCartItems;
        bundleCartItems = [];
      }

      // Final validation - ensure we have arrays
      if (!Array.isArray(variantCartItems)) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "validateVariantCartItems",
            new Error("variantCartItems is not an array"),
            { cartId, variantCartItemsType: typeof variantCartItems },
          ),
          "variantCartItems validation failed",
        );
        throw new BadRequestException(
          "Failed to separate cart items into variants and bundles",
        );
      }

      if (!Array.isArray(bundleCartItems)) {
        bundleCartItems = [];
      }

      const variantItemIds = variantCartItems.map((i) => i.id);
      const cartItemsWithVariants =
        await this.cartProcessingService.fetchCartItemProductData(
          variantItemIds,
        );

      if (!cartItemsWithVariants || !Array.isArray(cartItemsWithVariants)) {
        throw new BadRequestException("Failed to fetch cart item product data");
      }

      // Calculate totals
      const sellerState = this.validationService.getSellerState();
      if (!shippingAddress) {
        throw new BadRequestException("Shipping address not found");
      }
      const buyerState = shippingAddress.state;

      // Ensure bundleCartItems is defined and is an array
      const safeBundleCartItems =
        bundleCartItems && Array.isArray(bundleCartItems)
          ? bundleCartItems
          : [];

      const totals = await this.calculationService.calculateOrderTotals(
        cartItemsWithVariants.map((item) => ({
          price: item.price,
          quantity: item.quantity,
          productGstRate: item.productGstRate,
          productVariantId: item.productVariantId,
        })),
        safeBundleCartItems.map((item) => ({
          price: item.price,
          quantity: item.quantity,
          productVariantId: item.productVariantId,
        })),
        sellerState,
        buyerState,
        userId, // Pass customer ID for tax engine
      );
      const { subtotal, totalGstAmount } = totals;
      const shippingCost = createOrderDto.shippingCost || 0;

      // Flatten bundles for pricing/discount engines
      const bundleProcessingResult =
        await this.cartProcessingService.processBundleItems(
          safeBundleCartItems,
        );
      const { bundleVariantMapping, flattenedBundleVariants } =
        bundleProcessingResult;

      // Ensure flattenedBundleVariants is an array
      const safeFlattenedBundleVariants =
        flattenedBundleVariants && Array.isArray(flattenedBundleVariants)
          ? flattenedBundleVariants
          : [];

      // Get product IDs from variants (needed for both pricing and discount engines)
      const variantIds = [
        ...cartItemsWithVariants.map((item) => item.productVariantId),
        ...safeFlattenedBundleVariants.map((v) => v.variantId),
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
        safeBundleCartItems,
        safeFlattenedBundleVariants,
        variantToProductForPricing,
        productMapForPricing,
        subtotal,
      );
      const { pricingSnapshot, effectiveSubtotal } = pricingResult;

      // Ensure effectiveSubtotal is a valid number (fallback to subtotal if undefined/NaN)
      const safeEffectiveSubtotal =
        effectiveSubtotal !== undefined &&
        !Number.isNaN(effectiveSubtotal) &&
        effectiveSubtotal >= 0
          ? effectiveSubtotal
          : subtotal;

      // STEP 2: Use discount engine to calculate discount and generate snapshot
      // Discounts apply to effective prices from pricing engine
      const { discountAmount, discountSnapshot } =
        await this.discountEngineService.applyDiscounts(
          cart.id,
          checkoutSessionId,
          safeEffectiveSubtotal,
          customerId,
          userId,
          discountCode,
          createOrderDto.shippingCost || 0,
          cartItemsWithVariants,
          safeBundleCartItems,
          bundleVariantMapping,
          safeFlattenedBundleVariants,
          variantProductMap,
          productDetails,
        );

      // Calculate total after discount (discount applies to effective subtotal before GST)
      const subtotalAfterDiscount = Math.max(
        0,
        safeEffectiveSubtotal - discountAmount,
      );

      // Get payment method and fee from checkout metadata or DTO
      let paymentFee = 0;
      let paymentMethod: string | undefined;
      let paymentFeeBreakdown: PaymentFeeBreakdownDto | undefined;

      // Use paymentMethodId from DTO if provided, otherwise get from metadata
      if (createOrderDto.paymentMethodId) {
        paymentMethod = createOrderDto.paymentMethodId;
        // Calculate payment fee if not in metadata
        // checkoutSessionId should always be set at this point, but check defensively
        if (checkoutSessionId) {
          const existingMetadata =
            await this.checkoutStore.getCheckoutMetadata(checkoutSessionId);
          if (existingMetadata?.paymentFee !== undefined) {
            // Use existing fee from metadata
            paymentFee = existingMetadata.paymentFee; // Already in paise
            paymentFeeBreakdown = existingMetadata.paymentFeeBreakdown;
          } else {
            // Calculate payment fee for the selected method
            // Use subtotal after discount + shipping cost for fee calculation
            // Note: GST will be added later, but payment fees are typically calculated on subtotal + shipping
            const shippingCost = createOrderDto.shippingCost || 0;
            // Ensure subtotalAfterDiscount is a valid number
            const safeSubtotalAfterDiscount =
              Number.isNaN(subtotalAfterDiscount) || subtotalAfterDiscount < 0
                ? 0
                : subtotalAfterDiscount;
            const cartTotalWithShipping =
              safeSubtotalAfterDiscount + shippingCost;
            const cartTotalInPaise = Math.round(
              cartTotalWithShipping * PAISE_PER_RUPEE,
            );
            const feeResult = await this.calculationService.calculatePaymentFee(
              paymentMethod,
              cartTotalInPaise,
              "INR",
            );
            paymentFee = feeResult.fee; // Already in paise
            paymentFeeBreakdown = feeResult.breakdown as
              | PaymentFeeBreakdownDto
              | undefined;
          }
        } else {
          // If checkoutSessionId is not set but paymentMethodId is provided, calculate fee anyway
          // This should not happen in normal flow, but handle defensively
          const shippingCost = createOrderDto.shippingCost || 0;
          const safeSubtotalAfterDiscount =
            Number.isNaN(subtotalAfterDiscount) || subtotalAfterDiscount < 0
              ? 0
              : subtotalAfterDiscount;
          const cartTotalWithShipping =
            safeSubtotalAfterDiscount + shippingCost;
          const cartTotalInPaise = Math.round(
            cartTotalWithShipping * PAISE_PER_RUPEE,
          );
          const feeResult = await this.calculationService.calculatePaymentFee(
            paymentMethod,
            cartTotalInPaise,
            "INR",
          );
          paymentFee = feeResult.fee; // Already in paise
          paymentFeeBreakdown = feeResult.breakdown as
            | PaymentFeeBreakdownDto
            | undefined;
        }
      } else if (checkoutSessionId) {
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
          normalizedMethod:
            paymentMethod && typeof paymentMethod === "string"
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
        // Validate payment method is set
        if (!paymentMethod || typeof paymentMethod !== "string") {
          throw new BadRequestException(
            "Payment method is required for COD order creation",
          );
        }

        this.logger.info(
          createLogContext(this.contextService, "createCodOrder", {
            checkoutSessionId,
            cartId,
            paymentMethod,
          }),
          "COD payment method detected, creating order directly",
        );

        // Ensure checkout session is available
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
        safeEffectiveSubtotal,
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
