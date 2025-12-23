// External libraries
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  addresses,
  and,
  cartItems,
  desc,
  eq,
  ilike,
  inArray,
  orderItems,
  orders,
  payments,
  productCollections,
  products,
  productTags,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
// Internal modules - Common
import {
  COD_PAYMENT_METHOD,
  isCodPayment,
} from "../../common/constants/orders.constants";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import { calculateGstBreakdown } from "../../common/utils/gst.utils";
import type { Database } from "../../modules/database/db";
// Internal modules - Feature modules
import { CartsService } from "../carts/carts.service";
import { BundleCartItemMetadata } from "../carts/dto/bundle-cart-item.dto";
import { AddressesService } from "../customers/addresses.service";
import { CustomersService } from "../customers/customers.service";
import { DB_TOKEN } from "../database/database.module";
import { DiscountsService } from "../discounts/discounts.service";
import { runDiscountEngine } from "../discounts/engine/discount-engine";
import {
  DiscountEngineInput,
  DiscountSnapshot,
} from "../discounts/engine/discount-engine.types";
import { createDiscountSnapshot } from "../discounts/engine/discount-snapshot.utils";
import { DiscountAuditService } from "../discounts/services/discount-audit.service";
import { DiscountProfiler } from "../discounts/services/discount-profiler.service";
import { DiscountSnapshotValidator } from "../discounts/services/discount-snapshot-validator.service";
import { DriftDetectorService } from "../discounts/services/drift-detector.service";
import { HotReloadWatcher } from "../discounts/services/hot-reload-watcher.service";
import { RulesetBundleService } from "../discounts/services/ruleset-bundle.service";
// Relative imports - Services
import { OrderEventsService } from "../events/order-events.service";
import {
  OrderCreatedEventPayload,
  OrderPaymentCompletedEventPayload,
} from "../events/order-events.types";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../notifications/types/notification.types";
import { PaymentFeeBreakdownDto } from "../payments/dto/payment-charge.dto";
import { PaymentsService } from "../payments/payments.service";
import { PaymentChargeService } from "../payments/services/payment-charge.service";
import { PricingDriftSeverity } from "../pricing/audit/pricing-audit.types";
import { runPricingEngine } from "../pricing/engine/pricing-engine";
import {
  PricingEngineInput,
  PricingSnapshot,
} from "../pricing/engine/pricing-engine.types";
import { createPricingSnapshot } from "../pricing/engine/pricing-snapshot.utils";
import { BundlePricingService } from "../pricing/services/bundle-pricing.service";
import { CustomerGroupService } from "../pricing/services/customer-group.service";
import { PriceListService } from "../pricing/services/price-list.service";
import { PricingAuditService } from "../pricing/services/pricing-audit.service";
import { PricingDriftDetectorService } from "../pricing/services/pricing-drift-detector.service";
import { PricingHotReloadWatcher } from "../pricing/services/pricing-hot-reload-watcher.service";
import { PricingSnapshotValidator } from "../pricing/services/pricing-snapshot-validator.service";
import { CheckoutState } from "../redis-store/constants/checkout-states";
import { CheckoutMetadata } from "../redis-store/dto/checkout-metadata.dto";
import {
  PaymentIntent,
  PaymentIntentStatus,
} from "../redis-store/dto/payment-intent.dto";
import { CheckoutStore } from "../redis-store/stores/checkout-store";
import { InventoryStore } from "../redis-store/stores/inventory-store";
// Relative imports - DTOs
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderResponseDto } from "./dto/order-response.dto";
import { OrderTimelineDto } from "./dto/order-timeline.dto";
import { OrderTrackingDto } from "./dto/order-tracking.dto";
import { PaymentIntentResponseDto } from "./dto/payment-intent-response.dto";
import {
  OrderStatus,
  UpdateOrderStatusDto,
} from "./dto/update-order-status.dto";
import {
  isGuestCheckout,
  validateAuthenticatedCheckoutRequirements,
  validateGuestCheckoutRequirements,
} from "./services/order-creation.helper";
import { OrderGstService } from "./services/order-gst.service";
import { OrderPricingService } from "./services/order-pricing.service";
import { OrderStatusService } from "./services/order-status.service";
import { OrderTimelineService } from "./services/order-timeline.service";
import { OrderValidationService } from "./services/order-validation.service";

@Injectable()
export class OrdersService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly cartsService: CartsService,
    private readonly customersService: CustomersService,
    private readonly addressesService: AddressesService,
    private readonly discountsService: DiscountsService,
    private readonly inventoryStore: InventoryStore,
    private readonly checkoutStore: CheckoutStore,
    private readonly discountSnapshotValidator: DiscountSnapshotValidator,
    private readonly discountAuditService: DiscountAuditService,
    private readonly driftDetector: DriftDetectorService,
    private readonly hotReloadWatcher: HotReloadWatcher,
    private readonly bundleService: RulesetBundleService,
    private readonly discountProfiler: DiscountProfiler,
    private readonly pricingHotReloadWatcher: PricingHotReloadWatcher,
    readonly _priceListService: PriceListService,
    readonly _customerGroupService: CustomerGroupService,
    private readonly pricingSnapshotValidator: PricingSnapshotValidator,
    private readonly pricingAuditService: PricingAuditService,
    private readonly pricingDriftDetector: PricingDriftDetectorService,
    private readonly bundlePricingService: BundlePricingService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly paymentChargeService: PaymentChargeService,
    private readonly notificationsService: NotificationsService,
    // Extracted services
    private readonly validationService: OrderValidationService,
    private readonly pricingService: OrderPricingService,
    private readonly statusService: OrderStatusService,
    private readonly gstService: OrderGstService,
    private readonly timelineService: OrderTimelineService,
    private readonly orderEventsService: OrderEventsService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  // ============================================================================
  // Public API Methods - Order Lifecycle
  // ============================================================================

  /**
   * Create payment intent for checkout
   * Orders are now created only after payment confirmation via webhook
   * Supports both authenticated and guest checkout
   */
  @Trace({ operation: "OrdersService.create" })
  async create(
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
      // Determine if guest checkout or authenticated checkout
      const checkoutIsGuest = isGuestCheckout(userId, createOrderDto);

      if (checkoutIsGuest) {
        // Guest checkout flow
        // sessionId is guaranteed to be non-null after validation
        validateGuestCheckoutRequirements(createOrderDto, sessionId ?? null);

        // Extract validated values (guaranteed to exist after validation)
        const guestEmail = createOrderDto.email;
        const guestName = createOrderDto.name;
        const guestPhone = createOrderDto.phone;
        const guestAddress = createOrderDto.address;

        if (!guestEmail || !guestName || !guestPhone || !guestAddress) {
          throw new BadRequestException(
            "Missing required guest checkout fields",
          );
        }

        // Create or get guest customer
        const customer = await this.customersService.createGuestCustomer(
          guestEmail,
          guestName,
          guestPhone,
          createOrderDto.password || null,
        );
        customerId = customer.id;
        actualUserId = customer.userId;

        // Create addresses for guest customer
        const guestShippingAddress =
          await this.addressesService.createByCustomerId(customerId, {
            ...guestAddress,
            type: "shipping",
          });
        shippingAddressId = guestShippingAddress.id;
        shippingAddress = guestShippingAddress; // Store for later use

        // Create billing address (use same address if not specified separately)
        const billingAddress = await this.addressesService.createByCustomerId(
          customerId,
          {
            ...guestAddress,
            type: "billing",
          },
        );
        billingAddressId = billingAddress.id;

        // Get guest cart by sessionId
        // SessionId is guaranteed to exist due to validation in validateGuestCheckoutRequirements
        if (!sessionId) {
          throw new BadRequestException(
            "Session ID is required for guest checkout",
          );
        }
        const cart = await this.cartsService.getCart(null, sessionId);
        if (!cart || !cart.items || cart.items.length === 0) {
          throw new BadRequestException("Cart is empty");
        }
        cartId = cart.id;
      } else {
        // Authenticated checkout flow
        // userId is guaranteed to be non-null for authenticated checkout
        if (!userId) {
          throw new BadRequestException(
            "User ID is required for authenticated checkout",
          );
        }
        customerId = await this.getCustomerId(userId);
        validateAuthenticatedCheckoutRequirements(createOrderDto);

        // Extract validated address IDs (guaranteed to exist due to validation)
        const shippingAddrId = createOrderDto.shippingAddressId;
        const billingAddrId = createOrderDto.billingAddressId;

        if (!shippingAddrId || !billingAddrId) {
          throw new BadRequestException(
            "Shipping and billing address IDs are required",
          );
        }

        await this.validateAddresses(customerId, shippingAddrId, billingAddrId);
        shippingAddressId = shippingAddrId;
        billingAddressId = billingAddrId;

        // Fetch shipping address for state calculation
        const [fetchedShippingAddress] = await this.db
          .select()
          .from(addresses)
          .where(eq(addresses.id, shippingAddressId))
          .limit(1);
        if (fetchedShippingAddress) {
          shippingAddress = fetchedShippingAddress;
        }

        // Get customer cart after address validation
        const cart = await this.cartsService.getCart(userId, null);
        if (!cart || !cart.items || cart.items.length === 0) {
          throw new BadRequestException("Cart is empty");
        }
        cartId = cart.id;
      }

      if (!cartId) {
        throw new BadRequestException("Cart ID is required");
      }

      // Get cart object for later use (discount code, items, etc.)
      const cart = await this.cartsService.getCartById(cartId);

      // Check if checkout session ID is provided (from CheckoutService flow)
      // If provided, skip session creation and lock acquisition as they're already done
      checkoutSessionId = createOrderDto.checkoutSessionId || null;

      if (!checkoutSessionId) {
        // Legacy flow: Create checkout session for state machine tracking
        // Session tracks checkout progress: CREATED -> LOCKED -> COMPLETED/FAILED
        // If session creation fails, we continue without state tracking (graceful degradation)
        // This allows order creation to proceed even if Redis is temporarily unavailable
        try {
          const sessionResult = await this.checkoutStore.createSession(cartId);
          checkoutSessionId = sessionResult.sessionId;
        } catch (error) {
          // Session creation failure is non-fatal
          // Order creation can proceed without state machine tracking
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "createCheckoutSession",
              error,
              { cartId },
            ),
            "Failed to create checkout session, proceeding without state machine",
          );
        }

        // Acquire checkout lock to prevent concurrent checkout attempts on same cart
        // This prevents race conditions where multiple requests try to checkout simultaneously
        // Lock is held for the duration of checkout process
        lockAcquired = await this.checkoutStore.acquireCheckoutLock(cartId);
        if (!lockAcquired) {
          // Another checkout is in progress - mark session as failed if it exists
          if (checkoutSessionId) {
            try {
              await this.checkoutStore.failSession(checkoutSessionId);
            } catch (error) {
              console.error("Failed to fail checkout session:", error);
            }
          }
          throw new ConflictException("Cart is already being checked out");
        }

        // Transition session to LOCKED state (lock successfully acquired)
        // If state transition fails, we continue anyway since lock prevents duplicates
        // The lock is the source of truth for preventing concurrent checkouts
        if (checkoutSessionId) {
          try {
            await this.checkoutStore.transitionState(
              checkoutSessionId,
              CheckoutState.CREATED,
              CheckoutState.LOCKED,
            );
          } catch (error) {
            // State transition failure is non-fatal - lock is already held
            this.logger.error(
              createErrorContext(
                this.contextService,
                "transitionToLocked",
                error,
                { checkoutSessionId },
              ),
              "State transition to LOCKED failed, but lock is acquired",
            );
          }
        }
      } else {
        // Checkout session already exists (from CheckoutService flow)
        // Lock is already held by CheckoutService, so we don't need to acquire it
        this.logger.debug(
          createLogContext(this.contextService, "create", {
            checkoutSessionId,
            cartId,
          }),
          "Using existing checkout session from CheckoutService",
        );
        // Verify the session exists and is in LOCKED state
        const existingSession =
          await this.checkoutStore.getSession(checkoutSessionId);
        if (!existingSession) {
          throw new BadRequestException(
            `Checkout session ${checkoutSessionId} not found`,
          );
        }
        if (existingSession.cartId !== cartId) {
          throw new BadRequestException(
            `Checkout session cart ID mismatch: expected ${cartId}, got ${existingSession.cartId}`,
          );
        }
      }

      // Get discount code from cart
      const discountCode =
        "discountCode" in cart ? (cart.discountCode as string | null) : null;

      // Get cart items with metadata
      const cartItemIds = cart.items.map((item) => item.id);
      const allCartItems = await this.db
        .select({
          id: cartItems.id,
          productVariantId: cartItems.productVariantId,
          quantity: cartItems.quantity,
          price: cartItems.price,
          metadata: cartItems.metadata,
        })
        .from(cartItems)
        .where(inArray(cartItems.id, cartItemIds));

      if (allCartItems.length === 0) {
        throw new BadRequestException("Cart items not found or invalid");
      }

      // Separate bundle and variant items
      const bundleCartItems: Array<{
        id: string;
        productVariantId: string;
        quantity: number;
        price: number;
        metadata: unknown;
      }> = [];
      const variantCartItems: Array<{
        id: string;
        productVariantId: string;
        quantity: number;
        price: number;
        metadata: unknown;
      }> = [];

      for (const item of allCartItems) {
        const metadata = item.metadata as BundleCartItemMetadata | null;
        if (metadata?.type === "bundle") {
          bundleCartItems.push(item);
        } else {
          variantCartItems.push(item);
        }
      }

      // Get variant items with product details
      const variantItemIds = variantCartItems.map((i) => i.id);
      const cartItemsWithVariantsResult =
        variantItemIds.length > 0
          ? await this.db
              .select({
                cartItemId: cartItems.id,
                productVariantId: cartItems.productVariantId,
                quantity: cartItems.quantity,
                price: cartItems.price,
                productGstRate: products.gstRate,
              })
              .from(cartItems)
              .innerJoin(
                productVariants,
                eq(cartItems.productVariantId, productVariants.id),
              )
              .innerJoin(products, eq(productVariants.productId, products.id))
              .where(inArray(cartItems.id, variantItemIds))
          : [];

      const cartItemsWithVariants = Array.isArray(cartItemsWithVariantsResult)
        ? cartItemsWithVariantsResult
        : [];

      // Calculate totals
      const sellerState = this.getSellerState();
      if (!shippingAddress) {
        throw new BadRequestException("Shipping address not found");
      }
      const buyerState = shippingAddress.state;

      let subtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      // Calculate subtotal and GST for variant items
      for (const item of cartItemsWithVariants) {
        const itemSubtotal = item.price * item.quantity;
        subtotal += itemSubtotal;

        // Calculate GST breakdown
        const gstBreakdown = calculateGstBreakdown(
          itemSubtotal,
          item.productGstRate,
          sellerState,
          buyerState,
        );
        totalCgst += gstBreakdown.cgst;
        totalSgst += gstBreakdown.sgst;
        totalIgst += gstBreakdown.igst;
      }

      // Calculate subtotal and GST for bundle items
      for (const bundleItem of bundleCartItems) {
        const itemSubtotal = bundleItem.price * bundleItem.quantity;
        subtotal += itemSubtotal;

        // Get GST rate from first variant's product
        const [firstVariant] = await this.db
          .select({
            productId: productVariants.productId,
          })
          .from(productVariants)
          .where(eq(productVariants.id, bundleItem.productVariantId))
          .limit(1);

        if (firstVariant) {
          const [product] = await this.db
            .select({
              gstRate: products.gstRate,
            })
            .from(products)
            .where(eq(products.id, firstVariant.productId))
            .limit(1);

          if (product) {
            const gstBreakdown = calculateGstBreakdown(
              itemSubtotal,
              product.gstRate,
              sellerState,
              buyerState,
            );
            totalCgst += gstBreakdown.cgst;
            totalSgst += gstBreakdown.sgst;
            totalIgst += gstBreakdown.igst;
          }
        }
      }

      const totalGstAmount = totalCgst + totalSgst + totalIgst;
      const shippingCost = createOrderDto.shippingCost || 0;

      // Flatten bundles for pricing/discount engines
      const bundleVariantMapping = new Map<string, string[]>(); // bundleLineId -> [variantIds]
      const flattenedBundleVariants: Array<{
        variantId: string;
        productId: string;
        categoryId: string | null;
        basePrice: number;
        quantity: number;
        bundleLineId?: string;
      }> = [];

      for (const bundleItem of bundleCartItems) {
        const metadata = bundleItem.metadata as BundleCartItemMetadata;
        const variantQuantities =
          this.bundlePricingService.flattenBundleSelections(
            metadata.selections,
            bundleItem.quantity,
          );

        const bundleVariantIds: string[] = [];
        for (const vq of variantQuantities) {
          const [variant] = await this.db
            .select({
              productId: productVariants.productId,
            })
            .from(productVariants)
            .where(eq(productVariants.id, vq.variantId))
            .limit(1);

          if (variant) {
            bundleVariantIds.push(vq.variantId);
            const [product] = await this.db
              .select({
                categoryId: products.categoryId,
              })
              .from(products)
              .where(eq(products.id, variant.productId))
              .limit(1);

            // Get unit price from bundle breakdown
            const unitPrice = bundleItem.price / variantQuantities.length;
            flattenedBundleVariants.push({
              variantId: vq.variantId,
              productId: variant.productId,
              categoryId: product?.categoryId || null,
              basePrice: unitPrice,
              quantity: vq.quantity,
              bundleLineId: bundleItem.id,
            });
          }
        }
        bundleVariantMapping.set(bundleItem.id, bundleVariantIds);
      }

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

      const variantToProduct = new Map(
        variantProductMap.map((v) => [v.variantId, v.productId]),
      );
      const productMap = new Map(productDetails.map((p) => [p.productId, p]));

      // STEP 1: Run pricing engine to get effective prices (before discounts)
      let pricingSnapshot: PricingSnapshot | null = null;
      let effectiveSubtotal = subtotal; // Default to base subtotal

      try {
        // Get customer group for price list resolution
        const customerGroupId = customerId
          ? await this.getCustomerGroupId(customerId)
          : null;

        // Get active price lists for customer group
        const activePriceLists =
          await this.getPriceListsForCustomer(customerGroupId);

        // Build variant pricing input (variants + flattened bundles)
        const variantPricingInput = [
          ...cartItemsWithVariants.map((item) => {
            const productId = variantToProduct.get(item.productVariantId);
            const product = productId ? productMap.get(productId) : null;
            return {
              variantId: item.productVariantId,
              productId: productId || "",
              categoryId: product?.categoryId || null,
              basePrice: item.price,
              compareAtPrice: undefined, // TODO: Load from variant
              salePrice: undefined, // TODO: Load from variant
              saleStartDate: undefined,
              saleEndDate: undefined,
            };
          }),
          ...flattenedBundleVariants.map((v) => ({
            variantId: v.variantId,
            productId: v.productId,
            categoryId: v.categoryId,
            basePrice: v.basePrice,
            compareAtPrice: undefined,
            salePrice: undefined,
            saleStartDate: undefined,
            saleEndDate: undefined,
          })),
        ];

        // Run pricing engine
        const pricingInput: PricingEngineInput = {
          variants: variantPricingInput,
          customer: customerId
            ? {
                id: customerId,
                customerGroupId,
              }
            : null,
          priceLists: activePriceLists,
          now: new Date(),
        };

        const pricingResult = runPricingEngine(pricingInput);
        effectiveSubtotal = pricingResult.totalEffectivePrice;

        // Create bundle breakdowns for pricing snapshot
        const bundlePricingBreakdowns: Array<{
          bundleId: string;
          bundleLineId: string;
          unitBundlePrice: number;
          variantBreakdown: Array<{
            variantId: string;
            unitPrice: number;
            quantity: number;
          }>;
        }> = [];

        for (const bundleItem of bundleCartItems) {
          const metadata = bundleItem.metadata as BundleCartItemMetadata;
          const variantQuantities =
            this.bundlePricingService.flattenBundleSelections(
              metadata.selections,
              1, // unit quantity for breakdown
            );

          const variantBreakdown = variantQuantities.map((vq) => {
            const pricingResultItem = pricingResult.variantPrices.find(
              (vp) => vp.variantId === vq.variantId,
            );
            return {
              variantId: vq.variantId,
              unitPrice: pricingResultItem?.effectivePrice || vq.quantity,
              quantity: vq.quantity,
            };
          });

          bundlePricingBreakdowns.push({
            bundleId: metadata.bundleId,
            bundleLineId: bundleItem.id,
            unitBundlePrice: bundleItem.price,
            variantBreakdown,
          });
        }

        // Create pricing snapshot
        const rulesetVersion = this.pricingHotReloadWatcher.getCurrentVersion();
        pricingSnapshot = createPricingSnapshot(
          pricingResult,
          activePriceLists,
          rulesetVersion,
          bundlePricingBreakdowns.length > 0
            ? bundlePricingBreakdowns
            : undefined,
        );

        // Log pricing engine run
        try {
          await this.pricingAuditService.logEngineRun(
            checkoutSessionId || "",
            pricingResult,
            rulesetVersion,
          );
        } catch (error) {
          // Log but don't throw - audit logging failure shouldn't break checkout
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "logPricingEngineRun",
              error,
              { checkoutSessionId },
            ),
            "Failed to log pricing engine run",
          );
        }

        // Log snapshot creation
        try {
          await this.pricingAuditService.logSnapshotCreated(
            checkoutSessionId || "",
            pricingSnapshot,
          );
        } catch (error) {
          // Log but don't throw - audit logging failure shouldn't break checkout
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "logPricingSnapshotCreation",
              error,
              { checkoutSessionId },
            ),
            "Failed to log pricing snapshot creation",
          );
        }
      } catch (error) {
        // Pricing engine failed, continue with base prices
        this.logger.error(
          createErrorContext(this.contextService, "runPricingEngine", error, {
            checkoutSessionId,
            cartId,
          }),
          "Pricing engine error",
        );
        pricingSnapshot = null;
      }

      // STEP 2: Use discount engine to calculate discount and generate snapshot
      // Discounts apply to effective prices from pricing engine
      let discountAmount = 0;
      let discountSnapshot: DiscountSnapshot | null = null;

      try {
        // Product details already loaded above

        // Fetch collections for products
        const productCollectionData = await this.db
          .select({
            productId: productCollections.productId,
            collectionId: productCollections.collectionId,
          })
          .from(productCollections)
          .where(inArray(productCollections.productId, productIds));

        const collectionsByProduct = new Map<string, string[]>();
        for (const pc of productCollectionData) {
          if (!collectionsByProduct.has(pc.productId)) {
            collectionsByProduct.set(pc.productId, []);
          }
          collectionsByProduct.get(pc.productId)?.push(pc.collectionId);
        }

        // Fetch tags for products
        const productTagData = await this.db
          .select({
            productId: productTags.productId,
            tagId: productTags.tagId,
          })
          .from(productTags)
          .where(inArray(productTags.productId, productIds));

        const tagsByProduct = new Map<string, string[]>();
        for (const pt of productTagData) {
          if (!tagsByProduct.has(pt.productId)) {
            tagsByProduct.set(pt.productId, []);
          }
          tagsByProduct.get(pt.productId)?.push(pt.tagId);
        }

        const variantToProduct = new Map(
          variantProductMap.map((v) => [v.variantId, v.productId]),
        );
        const productMap = new Map(productDetails.map((p) => [p.productId, p]));

        // Build cart items for discount engine (variants + flattened bundles)
        const variantItemsForEngine = cartItemsWithVariants.map((item) => {
          const productId = variantToProduct.get(item.productVariantId);
          const product = productId ? productMap.get(productId) : null;
          return {
            id: item.cartItemId,
            productVariantId: item.productVariantId,
            productId: productId || "",
            categoryId: product?.categoryId || null,
            collectionIds: productId
              ? collectionsByProduct.get(productId) || []
              : [],
            tagIds: productId ? tagsByProduct.get(productId) || [] : [],
            price: item.price,
            quantity: item.quantity,
          };
        });

        // Add flattened bundle items to discount engine
        const flattenedBundleItemsForEngine = flattenedBundleVariants.map(
          (v) => {
            const productId = variantToProduct.get(v.variantId);
            const _product = productId ? productMap.get(productId) : null;
            return {
              id: `${v.bundleLineId}-${v.variantId}`, // Unique ID for flattened item
              productVariantId: v.variantId,
              productId: v.productId,
              categoryId: v.categoryId,
              collectionIds: productId
                ? collectionsByProduct.get(productId) || []
                : [],
              tagIds: productId ? tagsByProduct.get(productId) || [] : [],
              price: v.basePrice,
              quantity: v.quantity,
            };
          },
        );

        const cartItemsForEngine = [
          ...variantItemsForEngine,
          ...flattenedBundleItemsForEngine,
        ];

        // Get eligible discounts (use effective subtotal from pricing engine)
        const eligibleDiscounts =
          await this.discountsService.getEligibleDiscounts(
            effectiveSubtotal, // Use effective price from pricing engine
            customerId,
            userId || undefined,
            discountCode || undefined,
          );

        if (eligibleDiscounts.length > 0) {
          // Prepare customer data for engine
          const customerData = customerId
            ? {
                id: customerId,
                customerGroupIds: [], // TODO: Parse from customer data if available
              }
            : null;

          // Run discount engine with profiling
          const engineStartTime = Date.now();
          const shippingCost = createOrderDto.shippingCost || 0;
          const engineInput: DiscountEngineInput = {
            cart: {
              items: cartItemsForEngine,
            },
            customer: customerData,
            discounts: eligibleDiscounts,
            now: new Date(),
            shippingCost, // Pass shipping cost for TOTAL discount calculation
          };

          const engineResult = runDiscountEngine(engineInput);
          const engineRuntime = Date.now() - engineStartTime;
          discountAmount = engineResult.discountTotal;

          // Record profiler metrics
          const rulesetVersion = this.hotReloadWatcher.getCurrentVersion();
          const rulesApplied = engineResult.appliedDiscountIds.length;
          this.discountProfiler.recordEngineRun(
            rulesetVersion,
            engineRuntime,
            rulesApplied,
            true, // Cache hit (using in-memory bundle)
          );

          // Create bundle discount breakdowns
          const bundleDiscountBreakdowns: Array<{
            bundleId: string;
            bundleLineId: string;
            lineDiscountTotal: number;
            variantDiscounts: Array<{
              variantId: string;
              discountAmount: number;
              quantity: number;
            }>;
          }> = [];

          for (const bundleItem of bundleCartItems) {
            const metadata = bundleItem.metadata as BundleCartItemMetadata;
            const variantIds = bundleVariantMapping.get(bundleItem.id) || [];

            // Find discount results for bundle variants
            const variantDiscounts = variantIds.map((variantId) => {
              const lineItem = engineResult.lineItems.find(
                (li) => li.productVariantId === variantId,
              );
              const variantQuantity =
                flattenedBundleVariants.find(
                  (v) =>
                    v.variantId === variantId &&
                    v.bundleLineId === bundleItem.id,
                )?.quantity || 0;

              return {
                variantId,
                discountAmount:
                  lineItem?.discounts.reduce(
                    (sum, d) => sum + d.discountAmount,
                    0,
                  ) || 0,
                quantity: variantQuantity,
              };
            });

            const lineDiscountTotal = variantDiscounts.reduce(
              (sum, vd) => sum + vd.discountAmount * vd.quantity,
              0,
            );

            bundleDiscountBreakdowns.push({
              bundleId: metadata.bundleId,
              bundleLineId: bundleItem.id,
              lineDiscountTotal,
              variantDiscounts,
            });
          }

          // Create snapshot with versioning and integrity metadata
          discountSnapshot = createDiscountSnapshot(
            engineResult,
            eligibleDiscounts,
            rulesetVersion,
            bundleDiscountBreakdowns.length > 0
              ? bundleDiscountBreakdowns
              : undefined,
          );

          // Log discount engine run
          try {
            await this.discountAuditService.logEngineRun(
              cart.id,
              engineResult,
              eligibleDiscounts,
            );
          } catch (error) {
            // Log but don't throw - audit logging failure shouldn't break checkout
            this.logger.warn(
              createErrorContext(
                this.contextService,
                "logDiscountEngineRun",
                error,
                { checkoutSessionId, cartId },
              ),
              "Failed to log discount engine run",
            );
          }
        }
      } catch (error) {
        // Discount engine failed, continue without discount
        this.logger.error(
          createErrorContext(this.contextService, "runDiscountEngine", error, {
            checkoutSessionId,
            cartId,
          }),
          "Discount engine error",
        );
        discountAmount = 0;
        discountSnapshot = null;
      }

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
        const codOrder = await this.createCodOrder(
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
        paymentFee / 100;

      // Verify payment intent amount calculation includes fee
      const expectedAmountInPaise = Math.round(total * 100);
      const expectedComponents = {
        subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100),
        totalGstAmount: Math.round(totalGstAmount * 100),
        shippingCost: Math.round(shippingCost * 100),
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
        this.logger.debug(
          createLogContext(this.contextService, "storeCheckoutMetadata", {
            checkoutSessionId,
          }),
          "Stored checkout metadata",
        );
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "storeCheckoutMetadata",
            error,
            { checkoutSessionId },
          ),
          "Failed to store checkout metadata",
        );
        throw new ConflictException(
          "Failed to store checkout metadata - cannot proceed with payment intent creation",
        );
      }

      // Create payment intent (idempotent - will return existing if already created)
      // This ensures payment is initiated before order creation
      let paymentIntent: PaymentIntent;
      try {
        // Assert checkout state is LOCKED before creating payment intent
        await this.checkoutStore.assertState(
          checkoutSessionId,
          CheckoutState.LOCKED,
        );

        // Create payment intent idempotently
        // Amount is in rupees, convert to paise for Razorpay
        // CRITICAL: Amount MUST include payment fee (already included in total calculation above)
        const amountInPaise = Math.round(total * 100);

        // Verify amount includes fee before creating payment intent
        const expectedAmount =
          Math.round(
            (subtotalAfterDiscount + totalGstAmount + shippingCost) * 100,
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
              { checkoutSessionId, cartId, total },
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
          this.logger.warn(
            createLogContext(this.contextService, "createPaymentIntent", {
              checkoutSessionId,
            }),
            `Payment intent returned with empty paymentIntentId (placeholder) for checkoutSessionId=${checkoutSessionId}, retrying after delay`,
          );
          // Wait a bit longer for concurrent creation to complete
          await new Promise((resolve) => setTimeout(resolve, 500));
          // Try to get the payment intent again
          const retryPaymentIntent =
            await this.checkoutStore.getPaymentIntent(checkoutSessionId);
          if (
            retryPaymentIntent?.paymentIntentId &&
            retryPaymentIntent.paymentIntentId !== ""
          ) {
            paymentIntent = retryPaymentIntent;
            this.logger.info(
              createLogContext(this.contextService, "createPaymentIntent", {
                checkoutSessionId,
                paymentIntentId: paymentIntent.paymentIntentId,
              }),
              `Payment intent placeholder filled after retry for checkoutSessionId=${checkoutSessionId}`,
            );
          } else {
            const errorMessage = `Payment intent creation returned invalid result - paymentIntentId is empty after retry for checkoutSessionId=${checkoutSessionId}. The payment provider call may have timed out or failed. Please try again or contact support.`;
            this.logger.error(
              createErrorContext(
                this.contextService,
                "createPaymentIntent",
                new Error("Payment intent placeholder not filled after retry"),
                { checkoutSessionId, cartId, total },
              ),
              errorMessage,
            );
            throw new ConflictException(errorMessage);
          }
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
              subtotal: Math.round(subtotalAfterDiscount * 100),
              gst: Math.round(totalGstAmount * 100),
              shipping: Math.round(shippingCost * 100),
              fee: paymentFee,
              total: amountInPaise,
            },
          }),
          "Payment intent created with fee included",
        );

        // Detect drift during payment intent creation (discounts)
        if (discountSnapshot) {
          await this.driftDetector.detectPaymentIntentDrift(
            checkoutSessionId,
            total,
            amountInPaise / 100, // Convert from paise to rupees
            discountSnapshot,
          );

          // Log snapshot creation
          try {
            await this.discountAuditService.logSnapshotCreated(
              checkoutSessionId,
              discountSnapshot,
            );
          } catch (error) {
            // Log but don't throw - audit logging failure shouldn't break checkout
            this.logger.warn(
              createErrorContext(
                this.contextService,
                "logDiscountSnapshotCreation",
                error,
                { checkoutSessionId },
              ),
              "Failed to log discount snapshot creation",
            );
          }
        }

        // Detect pricing drift during payment intent creation
        if (pricingSnapshot) {
          try {
            await this.pricingDriftDetector.detectPaymentIntentDrift(
              checkoutSessionId,
              effectiveSubtotal,
              amountInPaise / 100, // Convert from paise to rupees (total includes GST + shipping)
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
                  total: amountInPaise / 100,
                },
              ),
              "Pricing drift detected",
            );
            throw error;
          }
        }
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
          createErrorContext(
            this.contextService,
            "createPaymentIntent",
            error,
            {
              checkoutSessionId,
              cartId,
              total,
              isTimeoutError,
              isNetworkError,
              errorType: error instanceof Error ? error.name : typeof error,
            },
          ),
          `Failed to create payment intent${isTimeoutError ? " (timeout)" : isNetworkError ? " (network error)" : ""}`,
        );
        throw new ConflictException(userFriendlyMessage);
      }

      // Release checkout lock - order creation will happen in webhook handler
      // Lock will be re-acquired in webhook handler before order creation
      if (lockAcquired && cartId) {
        try {
          await this.checkoutStore.releaseCheckoutLock(cartId);
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "releaseCheckoutLock",
              error,
              { cartId },
            ),
            "Failed to release checkout lock",
          );
        }
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
        try {
          await this.checkoutStore.failSession(checkoutSessionId);
        } catch (failError) {
          // Log but don't fail - failure handling should be best-effort
          this.logger.error(
            createErrorContext(
              this.contextService,
              "failCheckoutSession",
              failError,
              { checkoutSessionId },
            ),
            "Failed to fail checkout session",
          );
        }
      }

      // Release checkout lock only if it was acquired
      if (lockAcquired && cartId) {
        try {
          await this.checkoutStore.releaseCheckoutLock(cartId);
        } catch (lockError) {
          // Log but don't fail
          this.logger.error(
            createErrorContext(
              this.contextService,
              "releaseCheckoutLockOnError",
              lockError,
              { cartId },
            ),
            "Failed to release checkout lock on error",
          );
        }
      }

      throw error;
    }
  }

  /**
   * Create order directly for COD (Cash on Delivery) orders
   * COD orders skip payment intent creation and go straight to order creation
   */
  @Trace({ operation: "OrdersService.createCodOrder" })
  async createCodOrder(
    checkoutSessionId: string,
    userId: string | null,
    createOrderDto: CreateOrderDto,
    sessionId: string | null,
  ): Promise<OrderResponseDto> {
    // Get checkout session
    const session = await this.checkoutStore.getSession(checkoutSessionId);
    if (!session) {
      throw new NotFoundException(
        `Checkout session ${checkoutSessionId} not found`,
      );
    }

    // Validate state - must be LOCKED for COD orders
    if (session.state !== CheckoutState.LOCKED) {
      throw new ConflictException(
        `Cannot create COD order: checkout session is in state ${session.state}, expected LOCKED`,
      );
    }

    // Get checkout metadata
    const metadata =
      await this.checkoutStore.getCheckoutMetadata(checkoutSessionId);
    if (!metadata) {
      throw new NotFoundException(
        `Checkout metadata not found for session ${checkoutSessionId}`,
      );
    }

    // Verify payment method is COD (use helper function for consistency)
    if (!isCodPayment(metadata.paymentMethod)) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "createCodOrder",
          new Error("Invalid payment method for COD order"),
          {
            checkoutSessionId,
            paymentMethod: metadata.paymentMethod,
            expectedCOD: COD_PAYMENT_METHOD,
          },
        ),
        "Payment method validation failed for COD order",
      );
      throw new BadRequestException(
        `Expected COD payment method, got ${metadata.paymentMethod || "undefined"}`,
      );
    }

    // Use customerId from metadata (required field)
    const customerId = metadata.customerId;

    // Get cart data - use cartId from session
    const cart = await this.cartsService.getCartById(session.cartId);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty or not found");
    }

    // Get cart items with metadata
    const cartItemIds = cart.items.map((item) => item.id);
    const allCartItems = await this.db
      .select({
        id: cartItems.id,
        productVariantId: cartItems.productVariantId,
        quantity: cartItems.quantity,
        price: cartItems.price,
        metadata: cartItems.metadata,
      })
      .from(cartItems)
      .where(inArray(cartItems.id, cartItemIds));

    if (allCartItems.length === 0) {
      throw new BadRequestException("Cart items not found or invalid");
    }

    // Separate bundle and variant items
    const bundleCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }> = [];
    const variantCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }> = [];

    for (const item of allCartItems) {
      const itemMetadata = item.metadata as BundleCartItemMetadata | null;
      if (itemMetadata?.type === "bundle") {
        bundleCartItems.push(item);
      } else {
        variantCartItems.push(item);
      }
    }

    // Get variant items with product details
    const variantItemIds = variantCartItems.map((i) => i.id);
    const cartItemsWithVariantsResult =
      variantItemIds.length > 0
        ? await this.db
            .select({
              cartItemId: cartItems.id,
              productVariantId: cartItems.productVariantId,
              quantity: cartItems.quantity,
              price: cartItems.price,
              productGstRate: products.gstRate,
            })
            .from(cartItems)
            .innerJoin(
              productVariants,
              eq(cartItems.productVariantId, productVariants.id),
            )
            .innerJoin(products, eq(productVariants.productId, products.id))
            .where(inArray(cartItems.id, variantItemIds))
        : [];

    const cartItemsWithVariants = Array.isArray(cartItemsWithVariantsResult)
      ? cartItemsWithVariantsResult
      : [];

    // Get shipping address for GST calculation
    const [shippingAddress] = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.id, metadata.shippingAddressId))
      .limit(1);

    if (!shippingAddress) {
      throw new NotFoundException("Shipping address not found");
    }

    // Calculate totals
    const sellerState = this.getSellerState();
    const buyerState = shippingAddress.state;

    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const item of cartItemsWithVariants) {
      const itemSubtotal = item.price * item.quantity;
      subtotal += itemSubtotal;

      const gstBreakdown = calculateGstBreakdown(
        itemSubtotal,
        item.productGstRate,
        sellerState,
        buyerState,
      );
      totalCgst += gstBreakdown.cgst;
      totalSgst += gstBreakdown.sgst;
      totalIgst += gstBreakdown.igst;
    }

    const totalGstAmount = totalCgst + totalSgst + totalIgst;
    const shippingCost = metadata.shippingCost;

    // Use discount snapshot from checkout metadata
    let discountAmount = 0;
    let discountCode: string | null = null;
    if (metadata.discountSnapshot) {
      // Validate snapshot version exists (bundle available)
      if (metadata.discountSnapshot.rulesetVersion) {
        const bundle = await this.bundleService.getBundle(
          metadata.discountSnapshot.rulesetVersion,
        );
        if (!bundle) {
          this.logger.warn(
            createLogContext(this.contextService, "validateDiscountSnapshot", {
              checkoutSessionId,
              rulesetVersion: metadata.discountSnapshot.rulesetVersion,
            }),
            "Bundle not found for snapshot, but continuing with order creation",
          );
        }
      }

      // Validate snapshot integrity
      const snapshotTotal =
        metadata.discountSnapshot.total + totalGstAmount + shippingCost;

      this.discountSnapshotValidator.validateSnapshot(
        metadata.discountSnapshot,
        [],
        snapshotTotal,
      );

      discountAmount = metadata.discountSnapshot.discountTotal;
      // Extract discount code from snapshot
      if (metadata.discountSnapshot.cartDiscounts.length > 0) {
        discountCode = metadata.discountSnapshot.cartDiscounts[0].discountCode;
      } else if (
        metadata.discountSnapshot.lineItems.some(
          (item) => item.discounts.length > 0,
        )
      ) {
        const firstDiscount = metadata.discountSnapshot.lineItems.find(
          (item) => item.discounts.length > 0,
        );
        discountCode = firstDiscount?.discounts[0].discountCode || null;
      }
    }

    // Use effective subtotal from pricing snapshot if available
    let finalSubtotal = subtotal;
    if (metadata.pricingSnapshot) {
      try {
        this.pricingSnapshotValidator.validate(metadata.pricingSnapshot);
        finalSubtotal = metadata.pricingSnapshot.totalEffectivePrice;
      } catch (_error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "validatePricingSnapshot",
            _error,
            { checkoutSessionId },
          ),
          "Pricing snapshot validation failed",
        );
      }
    }
    const subtotalAfterDiscount = Math.max(0, finalSubtotal - discountAmount);

    // Get payment fee from metadata (already calculated)
    const paymentFee = metadata.paymentFee || 0;
    const paymentMethod = metadata.paymentMethod;
    const paymentFeeBreakdown = metadata.paymentFeeBreakdown || null;

    // Include payment fee in total (convert from paise to rupees)
    const total =
      subtotalAfterDiscount + totalGstAmount + shippingCost + paymentFee / 100;

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Create order in database
    const [order] = await this.db
      .insert(orders)
      .values({
        customerId,
        orderNumber,
        status: "pending",
        subtotal: finalSubtotal,
        gstAmount: totalGstAmount,
        discountCode,
        discountAmount,
        shippingCost,
        paymentFee,
        paymentMethod,
        paymentFeeBreakdown,
        total,
        shippingAddressId: metadata.shippingAddressId,
        billingAddressId: metadata.billingAddressId,
        razorpayOrderId: null, // COD orders don't have Razorpay order ID
        discountSnapshot: metadata.discountSnapshot,
        pricingSnapshot: metadata.pricingSnapshot,
      })
      .returning();

    const orderId = order.id;

    // Log snapshot usage
    if (metadata.discountSnapshot) {
      try {
        await this.discountAuditService.logSnapshotUsed(
          checkoutSessionId,
          orderId,
          metadata.discountSnapshot,
        );
      } catch (error) {
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "logDiscountSnapshotUsage",
            error,
            { checkoutSessionId, orderId },
          ),
          "Failed to log discount snapshot usage",
        );
      }
    }

    if (metadata.pricingSnapshot) {
      try {
        await this.pricingAuditService.logSnapshotUsed(
          checkoutSessionId,
          orderId,
          metadata.pricingSnapshot,
        );
      } catch (error) {
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "logPricingSnapshotUsage",
            error,
            { checkoutSessionId, orderId },
          ),
          "Failed to log pricing snapshot usage",
        );
      }
    }

    // Create order items using pricing snapshot prices (if available)
    const orderItemsToInsert: Array<{
      orderId: string;
      productVariantId: string;
      quantity: number;
      price: number;
      gstRate: number;
      gstAmount: number;
      metadata?: unknown;
    }> = [];

    // Create order items for variant items
    for (const item of cartItemsWithVariants) {
      // Use effective price from pricing snapshot if available, otherwise use cart price
      let itemPrice = item.price;
      if (metadata.pricingSnapshot) {
        const variantPrice = metadata.pricingSnapshot.variantPrices.find(
          (vp) => vp.variantId === item.productVariantId,
        );
        if (variantPrice) {
          itemPrice = variantPrice.effectivePrice;
        }
      }

      const itemSubtotal = itemPrice * item.quantity;
      const gstBreakdown = calculateGstBreakdown(
        itemSubtotal,
        item.productGstRate,
        sellerState,
        buyerState,
      );

      orderItemsToInsert.push({
        orderId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        price: itemPrice,
        gstRate: item.productGstRate,
        gstAmount: gstBreakdown.totalGst,
      });
    }

    // Expand bundles to multiple order items
    for (const bundleItem of bundleCartItems) {
      const bundleMetadata = bundleItem.metadata as BundleCartItemMetadata;
      const bundleBreakdown =
        metadata.pricingSnapshot?.bundleBreakdowns?.find(
          (b) => b.bundleLineId === bundleItem.id,
        ) ||
        metadata.pricingSnapshot?.bundleBreakdowns?.find(
          (b) => b.bundleId === bundleMetadata.bundleId,
        );

      if (bundleBreakdown) {
        // Use snapshot breakdown
        for (const variantBreakdown of bundleBreakdown.variantBreakdown) {
          // Get variant details for GST
          const [variant] = await this.db
            .select({
              productId: productVariants.productId,
            })
            .from(productVariants)
            .where(eq(productVariants.id, variantBreakdown.variantId))
            .limit(1);

          if (variant) {
            const [product] = await this.db
              .select({
                gstRate: products.gstRate,
              })
              .from(products)
              .where(eq(products.id, variant.productId))
              .limit(1);

            if (product) {
              const itemSubtotal =
                variantBreakdown.unitPrice * variantBreakdown.quantity;
              const gstBreakdown = calculateGstBreakdown(
                itemSubtotal,
                product.gstRate,
                sellerState,
                buyerState,
              );

              // Find which set this variant belongs to
              let setId: string | undefined;
              for (const [setIdKey, variantIds] of Object.entries(
                bundleMetadata.selections,
              )) {
                if (variantIds.includes(variantBreakdown.variantId)) {
                  setId = setIdKey;
                  break;
                }
              }

              orderItemsToInsert.push({
                orderId,
                productVariantId: variantBreakdown.variantId,
                quantity: variantBreakdown.quantity,
                price: variantBreakdown.unitPrice,
                gstRate: product.gstRate,
                gstAmount: gstBreakdown.totalGst,
                metadata: {
                  bundleId: bundleMetadata.bundleId,
                  bundleLineId: bundleItem.id,
                  setId,
                  isBundleComponent: true,
                } as unknown as Record<string, unknown>,
              });
            }
          }
        }
      } else {
        // Fallback: flatten bundle manually if snapshot not available
        const variantQuantities =
          this.bundlePricingService.flattenBundleSelections(
            bundleMetadata.selections,
            bundleItem.quantity,
          );

        for (const vq of variantQuantities) {
          const [variant] = await this.db
            .select({
              productId: productVariants.productId,
            })
            .from(productVariants)
            .where(eq(productVariants.id, vq.variantId))
            .limit(1);

          if (variant) {
            const [product] = await this.db
              .select({
                gstRate: products.gstRate,
              })
              .from(products)
              .where(eq(products.id, variant.productId))
              .limit(1);

            if (product) {
              // Use unit bundle price divided by variant count
              const unitPrice = bundleItem.price / variantQuantities.length;
              const itemSubtotal = unitPrice * vq.quantity;
              const gstBreakdown = calculateGstBreakdown(
                itemSubtotal,
                product.gstRate,
                sellerState,
                buyerState,
              );

              // Find which set this variant belongs to
              let setId: string | undefined;
              for (const [setIdKey, variantIds] of Object.entries(
                bundleMetadata.selections,
              )) {
                if (variantIds.includes(vq.variantId)) {
                  setId = setIdKey;
                  break;
                }
              }

              orderItemsToInsert.push({
                orderId,
                productVariantId: vq.variantId,
                quantity: vq.quantity,
                price: unitPrice,
                gstRate: product.gstRate,
                gstAmount: gstBreakdown.totalGst,
                metadata: {
                  bundleId: bundleMetadata.bundleId,
                  bundleLineId: bundleItem.id,
                  setId,
                  isBundleComponent: true,
                } as unknown as Record<string, unknown>,
              });
            }
          }
        }
      }
    }

    await this.db.insert(orderItems).values(orderItemsToInsert);

    // Create COD payment record (status: pending, will be marked as captured when delivered)
    await this.db.insert(payments).values({
      orderId,
      method: COD_PAYMENT_METHOD,
      status: "pending",
      amount: total, // Amount in rupees (real type)
      razorpayPaymentId: null,
      razorpayOrderId: null,
    });

    // COD orders: Transition through valid states
    // LOCKED → PAYMENT_CONFIRMED → ORDER_CREATED → COMPLETED
    // COD selection is equivalent to payment confirmation (commitment to pay on delivery)

    // Step 1: Transition to PAYMENT_CONFIRMED (COD = payment confirmed)
    try {
      this.logger.info(
        createLogContext(this.contextService, "codOrderStateTransition", {
          checkoutSessionId,
          orderId,
          fromState: CheckoutState.LOCKED,
          toState: CheckoutState.PAYMENT_CONFIRMED,
        }),
        "COD order: transitioning to PAYMENT_CONFIRMED state",
      );
      await this.checkoutStore.transitionState(
        checkoutSessionId,
        CheckoutState.LOCKED,
        CheckoutState.PAYMENT_CONFIRMED,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToPaymentConfirmed",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to transition to PAYMENT_CONFIRMED state for COD order",
      );
      throw error;
    }

    // Step 2: Set order and transition to ORDER_CREATED
    try {
      await this.checkoutStore.setOrder(checkoutSessionId, orderId);
      this.logger.info(
        createLogContext(this.contextService, "codOrderStateTransition", {
          checkoutSessionId,
          orderId,
          fromState: CheckoutState.PAYMENT_CONFIRMED,
          toState: CheckoutState.ORDER_CREATED,
        }),
        "COD order: transitioning to ORDER_CREATED state",
      );
      await this.checkoutStore.transitionState(
        checkoutSessionId,
        CheckoutState.PAYMENT_CONFIRMED,
        CheckoutState.ORDER_CREATED,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToOrderCreated",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to transition to ORDER_CREATED state for COD order",
      );
      throw error;
    }

    // Step 3: Transition to COMPLETED state
    try {
      this.logger.info(
        createLogContext(this.contextService, "codOrderStateTransition", {
          checkoutSessionId,
          orderId,
          fromState: CheckoutState.ORDER_CREATED,
          toState: CheckoutState.COMPLETED,
        }),
        "COD order: transitioning to COMPLETED state",
      );
      await this.checkoutStore.transitionState(
        checkoutSessionId,
        CheckoutState.ORDER_CREATED,
        CheckoutState.COMPLETED,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToCompleted",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to transition to COMPLETED state for COD order",
      );
      throw error;
    }

    // Clear cart
    try {
      await this.cartsService.clearCartById(session.cartId);
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "clearCart", error, {
          customerId,
          cartId: session.cartId,
        }),
        "Failed to clear cart after COD order creation",
      );
    }

    // Get order items for response
    const orderItemsList = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Calculate GST breakdown
    const gstBreakdown = {
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      totalGst: totalGstAmount,
      isIntraState: sellerState === buyerState,
    };

    // Send order confirmation notification
    try {
      await this.notificationsService.createFromEvent({
        adminId: null, // Broadcast to all admins
        type: NotificationType.ORDER,
        title: "New COD Order Received",
        message: `COD Order #${order.orderNumber} has been placed for ₹${total.toFixed(2)}`,
        meta: {
          orderId,
          orderNumber: order.orderNumber,
          total,
          customerId,
          paymentMethod: COD_PAYMENT_METHOD,
        },
      });
    } catch (error) {
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "createOrderNotification",
          error,
          {
            orderId,
            customerId,
          },
        ),
        "Failed to send order confirmation notification",
      );
    }

    return {
      ...order,
      gstBreakdown,
      items: orderItemsList,
    } as OrderResponseDto;
  }

  /**
   * Finalize order from payment confirmation (webhook-driven)
   * Creates order only after payment is confirmed
   * Uses payment-scoped idempotency to prevent duplicate orders
   */
  @Trace({ operation: "OrdersService.finalizeOrderFromPayment" })
  async finalizeOrderFromPayment(
    checkoutSessionId: string,
    paymentIntentId: string,
    provider: string = "razorpay",
  ): Promise<OrderResponseDto> {
    // Check payment-scoped idempotency first
    const existingOrderId = await this.checkoutStore.getOrderByPaymentIntent(
      provider,
      paymentIntentId,
    );

    if (existingOrderId) {
      // Order already exists for this payment intent - return existing order
      this.logger.debug(
        createLogContext(this.contextService, "finalizeOrderFromPayment", {
          paymentIntentId,
          orderId: existingOrderId,
          checkoutSessionId,
          provider,
        }),
        "Order already exists for payment intent",
      );
      // Fetch and return existing order
      const [order] = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, existingOrderId))
        .limit(1);

      if (!order) {
        throw new NotFoundException(
          `Order ${existingOrderId} not found for payment intent ${paymentIntentId}`,
        );
      }

      // Get order items for GST calculation
      const orderItemsList = await this.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      // Calculate GST breakdown (reconstruct from order data)
      const sellerState = this.getSellerState();
      const [shippingAddress] = await this.db
        .select()
        .from(addresses)
        .where(eq(addresses.id, order.shippingAddressId))
        .limit(1);
      const buyerState = shippingAddress?.state || sellerState;
      const isIntraState = sellerState === buyerState;

      // Reconstruct GST breakdown from order items
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      for (const orderItem of orderItemsList) {
        const itemSubtotal = orderItem.price * orderItem.quantity;
        const gstBreakdown = calculateGstBreakdown(
          itemSubtotal,
          orderItem.gstRate,
          sellerState,
          buyerState,
        );
        totalCgst += gstBreakdown.cgst;
        totalSgst += gstBreakdown.sgst;
        totalIgst += gstBreakdown.igst;
      }

      const gstBreakdown = {
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        totalGst: order.gstAmount,
        isIntraState,
      };

      return {
        ...order,
        gstBreakdown,
        items: orderItemsList,
      } as OrderResponseDto;
    }

    // Get checkout session and metadata
    const session = await this.checkoutStore.getSession(checkoutSessionId);
    if (!session) {
      throw new NotFoundException(
        `Checkout session ${checkoutSessionId} not found`,
      );
    }

    // Validate state - must be PAYMENT_CONFIRMED
    if (session.state !== CheckoutState.PAYMENT_CONFIRMED) {
      throw new ConflictException(
        `Cannot create order: checkout session is in state ${session.state}, expected PAYMENT_CONFIRMED`,
      );
    }

    // Get checkout metadata
    const metadata =
      await this.checkoutStore.getCheckoutMetadata(checkoutSessionId);
    if (!metadata) {
      throw new NotFoundException(
        `Checkout metadata not found for session ${checkoutSessionId}`,
      );
    }

    // Use customerId from metadata (required field)
    const customerId = metadata.customerId;

    // Get cart data - use cartId from session (more reliable than userId/sessionId lookup)
    const cart = await this.cartsService.getCartById(session.cartId);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty or not found");
    }

    // Get cart items with metadata
    const cartItemIds = cart.items.map((item) => item.id);
    const allCartItems = await this.db
      .select({
        id: cartItems.id,
        productVariantId: cartItems.productVariantId,
        quantity: cartItems.quantity,
        price: cartItems.price,
        metadata: cartItems.metadata,
      })
      .from(cartItems)
      .where(inArray(cartItems.id, cartItemIds));

    if (allCartItems.length === 0) {
      throw new BadRequestException("Cart items not found or invalid");
    }

    // Separate bundle and variant items
    const bundleCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }> = [];
    const variantCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }> = [];

    for (const item of allCartItems) {
      const metadata = item.metadata as BundleCartItemMetadata | null;
      if (metadata?.type === "bundle") {
        bundleCartItems.push(item);
      } else {
        variantCartItems.push(item);
      }
    }

    // Get variant items with product details
    const variantItemIds = variantCartItems.map((i) => i.id);
    const cartItemsWithVariantsResult =
      variantItemIds.length > 0
        ? await this.db
            .select({
              cartItemId: cartItems.id,
              productVariantId: cartItems.productVariantId,
              quantity: cartItems.quantity,
              price: cartItems.price,
              productGstRate: products.gstRate,
            })
            .from(cartItems)
            .innerJoin(
              productVariants,
              eq(cartItems.productVariantId, productVariants.id),
            )
            .innerJoin(products, eq(productVariants.productId, products.id))
            .where(inArray(cartItems.id, variantItemIds))
        : [];

    const cartItemsWithVariants = Array.isArray(cartItemsWithVariantsResult)
      ? cartItemsWithVariantsResult
      : [];

    // Get shipping address for GST calculation
    const [shippingAddress] = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.id, metadata.shippingAddressId))
      .limit(1);

    if (!shippingAddress) {
      throw new NotFoundException("Shipping address not found");
    }

    // Calculate totals
    const sellerState = this.getSellerState();
    const buyerState = shippingAddress.state;

    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const item of cartItemsWithVariants) {
      const itemSubtotal = item.price * item.quantity;
      subtotal += itemSubtotal;

      const gstBreakdown = calculateGstBreakdown(
        itemSubtotal,
        item.productGstRate,
        sellerState,
        buyerState,
      );
      totalCgst += gstBreakdown.cgst;
      totalSgst += gstBreakdown.sgst;
      totalIgst += gstBreakdown.igst;
    }

    const totalGstAmount = totalCgst + totalSgst + totalIgst;
    const shippingCost = metadata.shippingCost;

    // Use discount snapshot from checkout metadata (don't recalculate)
    // This ensures consistency between payment intent and order creation
    let discountAmount = 0;
    let discountCode: string | null = null;
    if (metadata.discountSnapshot) {
      // Validate snapshot version exists (bundle available)
      if (metadata.discountSnapshot.rulesetVersion) {
        const bundle = await this.bundleService.getBundle(
          metadata.discountSnapshot.rulesetVersion,
        );
        if (!bundle) {
          this.logger.warn(
            createLogContext(this.contextService, "validateDiscountSnapshot", {
              checkoutSessionId,
              rulesetVersion: metadata.discountSnapshot.rulesetVersion,
            }),
            "Bundle not found for snapshot, but continuing with order creation",
          );
        }
      }

      // Validate snapshot integrity
      // Note: Payment intent amount validation is skipped as amount is not stored in PaymentIntent
      // The snapshot total itself is what was sent to payment provider, so we validate snapshot structure
      const snapshotTotal =
        metadata.discountSnapshot.total + totalGstAmount + shippingCost;

      this.discountSnapshotValidator.validateSnapshot(
        metadata.discountSnapshot,
        [], // Applied discounts not needed for validation (snapshot already contains them)
        snapshotTotal, // Use snapshot total + GST + shipping for validation
      );

      discountAmount = metadata.discountSnapshot.discountTotal;
      // Extract discount code from snapshot (use first applied discount code)
      if (metadata.discountSnapshot.cartDiscounts.length > 0) {
        discountCode = metadata.discountSnapshot.cartDiscounts[0].discountCode;
      } else if (
        metadata.discountSnapshot.lineItems.some(
          (item) => item.discounts.length > 0,
        )
      ) {
        const firstDiscount = metadata.discountSnapshot.lineItems.find(
          (item) => item.discounts.length > 0,
        );
        discountCode = firstDiscount?.discounts[0].discountCode || null;
      }
    } else {
      // Fallback: if snapshot not available, log warning but continue
      this.logger.warn(
        createLogContext(this.contextService, "finalizeOrderFromPayment", {
          checkoutSessionId,
        }),
        "Discount snapshot not found in checkout metadata, using 0 discount",
      );
    }

    // Use effective subtotal from pricing snapshot if available
    let finalSubtotal = subtotal;
    if (metadata.pricingSnapshot) {
      // Validate pricing snapshot
      try {
        this.pricingSnapshotValidator.validate(metadata.pricingSnapshot);
        finalSubtotal = metadata.pricingSnapshot.totalEffectivePrice;
      } catch (_error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "validatePricingSnapshot",
            _error,
            { checkoutSessionId },
          ),
          "Pricing snapshot validation failed",
        );
        // Continue with base subtotal if snapshot invalid
      }
    }
    const subtotalAfterDiscount = Math.max(0, finalSubtotal - discountAmount);

    // Calculate payment fee
    let paymentFee = 0;
    let paymentMethod: string | null = null;
    let paymentFeeBreakdown: PaymentFeeBreakdownDto | null = null;
    const _paymentFeeCurrency = "INR"; // Default currency (TODO: Get from store config)

    if (metadata.paymentMethod && metadata.paymentFee !== undefined) {
      // Use payment fee from metadata (already calculated during checkout)
      paymentFee = metadata.paymentFee;
      paymentMethod = metadata.paymentMethod;
      paymentFeeBreakdown = metadata.paymentFeeBreakdown || null;
      // TODO: Get currency from metadata or store config
      // For now, default to INR
    } else if (metadata.paymentMethod) {
      // Payment method selected but fee not calculated - calculate it now
      const cartTotalInPaise = Math.round(
        (subtotalAfterDiscount + totalGstAmount + shippingCost) * 100,
      );
      const { fee, breakdown } = await this.paymentChargeService.calculateFee(
        metadata.paymentMethod,
        cartTotalInPaise,
        "INR", // TODO: Get currency from store config
      );
      paymentFee = fee;
      paymentMethod = metadata.paymentMethod;
      paymentFeeBreakdown = breakdown;
    }

    // Include payment fee in total (convert from paise to rupees)
    const total =
      subtotalAfterDiscount + totalGstAmount + shippingCost + paymentFee / 100;

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Create order atomically using payment-scoped idempotency
    let orderId: string;
    try {
      // Create order in database with discount snapshot
      const [order] = await this.db
        .insert(orders)
        .values({
          customerId,
          orderNumber,
          status: "pending",
          subtotal: finalSubtotal, // Use effective subtotal from pricing snapshot
          gstAmount: totalGstAmount,
          discountCode,
          discountAmount,
          shippingCost,
          paymentFee, // Payment fee in paise
          paymentMethod, // Selected payment method
          paymentFeeBreakdown, // Payment fee breakdown
          total,
          shippingAddressId: metadata.shippingAddressId,
          billingAddressId: metadata.billingAddressId,
          razorpayOrderId: paymentIntentId,
          discountSnapshot: metadata.discountSnapshot, // Store full snapshot for refunds/historical accuracy
          pricingSnapshot: metadata.pricingSnapshot, // Store pricing snapshot for refunds/historical accuracy
        })
        .returning();

      orderId = order.id;

      // Log snapshot usage for order creation
      if (metadata.discountSnapshot) {
        try {
          await this.discountAuditService.logSnapshotUsed(
            checkoutSessionId,
            orderId,
            metadata.discountSnapshot,
          );
        } catch (error) {
          // Log but don't throw - audit logging failure shouldn't break order creation
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "logDiscountSnapshotUsage",
              error,
              { checkoutSessionId, orderId },
            ),
            "Failed to log discount snapshot usage",
          );
        }
      }

      // Log pricing snapshot usage
      if (metadata.pricingSnapshot) {
        try {
          await this.pricingAuditService.logSnapshotUsed(
            checkoutSessionId,
            orderId,
            metadata.pricingSnapshot,
          );
        } catch (error) {
          // Log but don't throw - audit logging failure shouldn't break order creation
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "logPricingSnapshotUsage",
              error,
              { checkoutSessionId, orderId },
            ),
            "Failed to log pricing snapshot usage",
          );
        }

        // Detect drift during order creation
        try {
          const customerGroupId = await this.getCustomerGroupId(customerId);
          const currentPriceLists =
            await this.getPriceListsForCustomer(customerGroupId);
          const driftResult =
            await this.pricingDriftDetector.detectOrderCreationDrift(
              checkoutSessionId,
              orderId,
              metadata.pricingSnapshot,
              currentPriceLists,
            );

          if (
            driftResult.hasDrift &&
            driftResult.severity === PricingDriftSeverity.CRITICAL
          ) {
            this.logger.error(
              createLogContext(this.contextService, "detectPricingDrift", {
                checkoutSessionId,
                orderId,
                hasDrift: driftResult.hasDrift,
                severity: driftResult.severity,
                driftDetails: driftResult.details,
              }),
              "Critical pricing drift detected",
            );
            // Don't throw - order is already created, drift is logged
          }
        } catch (error) {
          // Log but don't throw - drift detection failure shouldn't break order creation
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "detectPricingDrift",
              error,
              { checkoutSessionId, orderId },
            ),
            "Failed to detect pricing drift",
          );
        }
      }

      // Atomically create payment-scoped idempotency mapping
      // This ensures exactly one order per payment intent
      const mappedOrderId = await this.checkoutStore.createOrderFromPayment(
        provider,
        paymentIntentId,
        orderId,
      );

      // If mapping returned different order ID, another process created it concurrently
      if (mappedOrderId !== orderId) {
        this.logger.warn(
          createLogContext(this.contextService, "finalizeOrderFromPayment", {
            orderId,
            mappedOrderId,
            paymentIntentId,
            checkoutSessionId,
            provider,
          }),
          "Concurrent order creation detected, using existing order",
        );
        // Delete the duplicate order we just created
        await this.db.delete(orders).where(eq(orders.id, orderId));
        // Return existing order
        return this.finalizeOrderFromPayment(
          checkoutSessionId,
          paymentIntentId,
          provider,
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "finalizeOrderFromPayment",
          error,
          { paymentIntentId, checkoutSessionId, provider },
        ),
        "Failed to create order",
      );
      throw error;
    }

    // Transition to ORDER_CREATED state
    try {
      await this.checkoutStore.setOrder(checkoutSessionId, orderId);
      await this.checkoutStore.transitionState(
        checkoutSessionId,
        CheckoutState.PAYMENT_CONFIRMED,
        CheckoutState.ORDER_CREATED,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToOrderCreated",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to transition to ORDER_CREATED",
      );
      // Continue - order is created, state transition failure is non-critical
    }

    // Create notification for new order
    try {
      await this.notificationsService.createFromEvent({
        adminId: null, // Broadcast to all admins
        type: NotificationType.ORDER,
        title: "New Order Received",
        message: `Order #${orderNumber} has been placed for ₹${total.toFixed(2)}`,
        meta: {
          orderId,
          orderNumber,
          total,
          customerId,
        },
      });
    } catch (error) {
      // Log but don't throw - notification failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "createOrderNotification",
          error,
          { orderId, orderNumber },
        ),
        "Failed to create order notification",
      );
    }

    // Record discount usage if discount was applied
    if (discountCode && discountAmount > 0) {
      try {
        const discount = await this.discountsService.findByCode(discountCode);
        await this.discountsService.recordUsage(
          discount.id,
          orderId,
          metadata.userId || undefined,
        );
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "recordDiscountUsage",
            error,
            { orderId, discountCode, customerId: metadata.userId },
          ),
          "Failed to record discount usage",
        );
      }
    }

    // Create order items using pricing snapshot prices (if available)
    const orderItemsToInsert: Array<{
      orderId: string;
      productVariantId: string;
      quantity: number;
      price: number;
      gstRate: number;
      gstAmount: number;
      metadata?: unknown;
    }> = [];

    // Create order items for variant items
    for (const item of cartItemsWithVariants) {
      // Use effective price from pricing snapshot if available, otherwise use cart price
      let itemPrice = item.price;
      if (metadata.pricingSnapshot) {
        const variantPrice = metadata.pricingSnapshot.variantPrices.find(
          (vp) => vp.variantId === item.productVariantId,
        );
        if (variantPrice) {
          itemPrice = variantPrice.effectivePrice;
        }
      }

      const itemSubtotal = itemPrice * item.quantity;
      const gstBreakdown = calculateGstBreakdown(
        itemSubtotal,
        item.productGstRate,
        sellerState,
        buyerState,
      );

      orderItemsToInsert.push({
        orderId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        price: itemPrice, // Use effective price from pricing snapshot
        gstRate: item.productGstRate,
        gstAmount: gstBreakdown.totalGst,
      });
    }

    // Expand bundles to multiple order items
    for (const bundleItem of bundleCartItems) {
      const bundleMetadata = bundleItem.metadata as BundleCartItemMetadata;
      const bundleBreakdown =
        metadata.pricingSnapshot?.bundleBreakdowns?.find(
          (b) => b.bundleLineId === bundleItem.id,
        ) ||
        metadata.pricingSnapshot?.bundleBreakdowns?.find(
          (b) => b.bundleId === bundleMetadata.bundleId,
        );

      if (bundleBreakdown) {
        // Use snapshot breakdown
        for (const variantBreakdown of bundleBreakdown.variantBreakdown) {
          // Get variant details for GST
          const [variant] = await this.db
            .select({
              productId: productVariants.productId,
            })
            .from(productVariants)
            .where(eq(productVariants.id, variantBreakdown.variantId))
            .limit(1);

          if (variant) {
            const [product] = await this.db
              .select({
                gstRate: products.gstRate,
              })
              .from(products)
              .where(eq(products.id, variant.productId))
              .limit(1);

            if (product) {
              const itemSubtotal =
                variantBreakdown.unitPrice * variantBreakdown.quantity;
              const gstBreakdown = calculateGstBreakdown(
                itemSubtotal,
                product.gstRate,
                sellerState,
                buyerState,
              );

              // Find which set this variant belongs to
              let setId: string | undefined;
              for (const [setIdKey, variantIds] of Object.entries(
                bundleMetadata.selections,
              )) {
                if (variantIds.includes(variantBreakdown.variantId)) {
                  setId = setIdKey;
                  break;
                }
              }

              orderItemsToInsert.push({
                orderId,
                productVariantId: variantBreakdown.variantId,
                quantity: variantBreakdown.quantity,
                price: variantBreakdown.unitPrice,
                gstRate: product.gstRate,
                gstAmount: gstBreakdown.totalGst,
                metadata: {
                  bundleId: bundleMetadata.bundleId,
                  bundleLineId: bundleItem.id,
                  setId,
                  isBundleComponent: true,
                } as unknown as Record<string, unknown>,
              });
            }
          }
        }
      } else {
        // Fallback: flatten bundle manually if snapshot not available
        const variantQuantities =
          this.bundlePricingService.flattenBundleSelections(
            bundleMetadata.selections,
            bundleItem.quantity,
          );

        for (const vq of variantQuantities) {
          const [variant] = await this.db
            .select({
              productId: productVariants.productId,
            })
            .from(productVariants)
            .where(eq(productVariants.id, vq.variantId))
            .limit(1);

          if (variant) {
            const [product] = await this.db
              .select({
                gstRate: products.gstRate,
              })
              .from(products)
              .where(eq(products.id, variant.productId))
              .limit(1);

            if (product) {
              // Use unit bundle price divided by variant count
              const unitPrice = bundleItem.price / variantQuantities.length;
              const itemSubtotal = unitPrice * vq.quantity;
              const gstBreakdown = calculateGstBreakdown(
                itemSubtotal,
                product.gstRate,
                sellerState,
                buyerState,
              );

              // Find which set this variant belongs to
              let setId: string | undefined;
              for (const [setIdKey, variantIds] of Object.entries(
                bundleMetadata.selections,
              )) {
                if (variantIds.includes(vq.variantId)) {
                  setId = setIdKey;
                  break;
                }
              }

              orderItemsToInsert.push({
                orderId,
                productVariantId: vq.variantId,
                quantity: vq.quantity,
                price: unitPrice,
                gstRate: product.gstRate,
                gstAmount: gstBreakdown.totalGst,
                metadata: {
                  bundleId: bundleMetadata.bundleId,
                  bundleLineId: bundleItem.id,
                  setId,
                  isBundleComponent: true,
                } as unknown as Record<string, unknown>,
              });
            }
          }
        }
      }
    }

    const insertedOrderItems = await this.db
      .insert(orderItems)
      .values(orderItemsToInsert)
      .returning();

    // Commit inventory (convert reserved → consumed)
    // This happens AFTER payment confirmation
    // CRITICAL: Inventory MUST be decremented when order is placed
    // If this fails, inventory will be out of sync and needs manual reconciliation
    try {
      // Release all cart reservations (individual reservation keys)
      await this.inventoryStore.releaseCartReservations(cart.id);

      // Commit reservations for variant items
      for (const item of cartItemsWithVariants) {
        await this.inventoryStore.incrementInventory(
          item.productVariantId,
          -item.quantity,
        );
      }

      // Commit reservations for bundle items (all variants)
      for (const bundleItem of bundleCartItems) {
        const bundleMetadata = bundleItem.metadata as BundleCartItemMetadata;
        const variantQuantities =
          this.bundlePricingService.flattenBundleSelections(
            bundleMetadata.selections,
            bundleItem.quantity,
          );

        for (const vq of variantQuantities) {
          await this.inventoryStore.incrementInventory(
            vq.variantId,
            -vq.quantity,
          );
        }
      }

      this.logger.info(
        createLogContext(this.contextService, "commitInventory", {
          orderId,
          variantItemsCount: cartItemsWithVariants.length,
          bundleItemsCount: bundleCartItems.length,
        }),
        "Inventory successfully decremented for order",
      );
    } catch (error) {
      // CRITICAL ERROR: Inventory decrement failed
      // Order is already created, but inventory wasn't decremented
      // This needs to be reconciled manually or via a background job
      this.logger.error(
        createErrorContext(this.contextService, "commitInventory", error, {
          orderId,
          variantItemsCount: cartItemsWithVariants.length,
          bundleItemsCount: bundleCartItems.length,
          critical: true,
        }),
        "CRITICAL: Failed to commit inventory for order - manual reconciliation required",
      );
      // Continue - inventory commit failure should be handled separately
      // Order is already created, inventory can be reconciled later
      // TODO: Consider adding a background job to reconcile failed inventory commits
    }

    // Clear cart - use cartId from session
    try {
      const cart = await this.cartsService.getCartById(session.cartId);
      if (cart) {
        await this.cartsService.clearCart(metadata.userId, cart.sessionId);
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "clearCart", error, {
          userId: metadata.userId,
          orderId,
          cartId: session.cartId,
        }),
        "Failed to clear cart",
      );
    }

    // Calculate overall GST breakdown
    const isIntraState = sellerState === buyerState;
    const gstBreakdown = {
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      totalGst: totalGstAmount,
      isIntraState,
    };

    // Build order response
    const orderResponse: OrderResponseDto = {
      id: orderId,
      customerId,
      orderNumber,
      status: "pending",
      subtotal,
      gstAmount: totalGstAmount,
      gstBreakdown,
      shippingCost,
      paymentFee: paymentFee > 0 ? paymentFee : undefined,
      paymentMethod: paymentMethod || null,
      paymentFeeBreakdown: paymentFeeBreakdown || null,
      total,
      razorpayOrderId: paymentIntentId,
      shippingProvider: null,
      shippingAddressId: metadata.shippingAddressId,
      billingAddressId: metadata.billingAddressId,
      discountCode,
      discountAmount,
      items: insertedOrderItems,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as OrderResponseDto;

    // Transition to COMPLETED state
    try {
      await this.checkoutStore.transitionState(
        checkoutSessionId,
        CheckoutState.ORDER_CREATED,
        CheckoutState.COMPLETED,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToCompleted",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to transition to COMPLETED",
      );
    }

    this.logger.info(
      createLogContext(this.contextService, "finalizeOrderFromPayment", {
        orderId,
        paymentIntentId,
        checkoutSessionId,
        provider,
      }),
      "Order finalized",
    );

    // Emit order created event
    try {
      await this.orderEventsService.emitOrderCreated({
        orderId,
        orderNumber,
        customerId,
        timestamp: new Date(),
        total,
        itemsCount: insertedOrderItems.length,
        metadata: {
          paymentIntentId,
          checkoutSessionId,
          provider,
        },
      } as OrderCreatedEventPayload);

      // Emit payment completed event
      await this.orderEventsService.emitPaymentCompleted({
        orderId,
        orderNumber,
        customerId,
        timestamp: new Date(),
        paymentIntentId,
        amount: total,
        paymentMethod: metadata.paymentMethod || "online",
        metadata: {
          provider,
        },
      } as OrderPaymentCompletedEventPayload);
    } catch (error) {
      // Log but don't throw - event emission failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(this.contextService, "emitOrderEvents", error, {
          orderId,
          orderNumber,
        }),
        "Failed to emit order events",
      );
    }

    return orderResponse;
  }

  // ============================================================================
  // Public API Methods - Order Retrieval
  // ============================================================================

  /**
   * Get order by ID (for authenticated customer)
   */
  @Trace({ operation: "OrdersService.findOne" })
  async findOne(userId: string, orderId: string) {
    try {
      const customerId = await this.getCustomerId(userId);

      let order: typeof orders.$inferSelect | undefined;
      try {
        const orderResult = await this.db
          .select()
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
          .limit(1);
        order = orderResult[0];
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "OrdersService.findOne.selectOrder",
            error,
            { orderId, customerId },
          ),
          "Failed to fetch order",
        );
        throw new NotFoundException("Order not found");
      }

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Get order items with GST rates
      let items: Array<{
        id: string;
        orderId: string;
        productVariantId: string;
        quantity: number;
        price: number;
        gstRate: number;
        gstAmount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      try {
        items = await this.db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productVariantId: orderItems.productVariantId,
            quantity: orderItems.quantity,
            price: orderItems.price,
            gstRate: orderItems.gstRate,
            gstAmount: orderItems.gstAmount,
            createdAt: orderItems.createdAt,
            updatedAt: orderItems.updatedAt,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "OrdersService.findOne.selectItems",
            error,
            { orderId },
          ),
          "Failed to fetch order items",
        );
        items = [];
      }

      // Get shipping address for GST calculation
      let shippingAddress: { state: string } | undefined;
      try {
        const addressResult = await this.db
          .select({ state: addresses.state })
          .from(addresses)
          .where(eq(addresses.id, order.shippingAddressId))
          .limit(1);
        shippingAddress = addressResult[0];
      } catch (error) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "OrdersService.findOne.selectAddress",
            {
              orderId,
              shippingAddressId: order.shippingAddressId,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to fetch shipping address, using default state",
        );
        shippingAddress = undefined;
      }

      // Calculate GST breakdown
      const sellerState = this.getSellerState();
      const buyerState = shippingAddress?.state || "";

      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      for (const item of items) {
        try {
          const itemSubtotal = item.price * item.quantity;
          const gstBreakdown = calculateGstBreakdown(
            itemSubtotal,
            item.gstRate,
            sellerState,
            buyerState,
          );
          totalCgst += gstBreakdown.cgst;
          totalSgst += gstBreakdown.sgst;
          totalIgst += gstBreakdown.igst;
        } catch (error) {
          this.logger.warn(
            createLogContext(
              this.contextService,
              "OrdersService.findOne.calculateGst",
              {
                orderId,
                itemId: item.id,
                error: error instanceof Error ? error.message : String(error),
              },
            ),
            "Failed to calculate GST for item, skipping",
          );
        }
      }

      const gstBreakdown = {
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        totalGst: order.gstAmount || 0,
        isIntraState: sellerState === buyerState,
      };

      // Validate and parse payment fee breakdown
      let paymentFeeBreakdown:
        | {
            method: string;
            chargeType: string;
            calculatedFee: number;
            flatAmount?: number;
            percentage?: number;
            mixMin?: number;
            mixCap?: number;
          }
        | null
        | undefined = null;

      if (order.paymentFeeBreakdown) {
        try {
          const parsed =
            typeof order.paymentFeeBreakdown === "string"
              ? JSON.parse(order.paymentFeeBreakdown)
              : order.paymentFeeBreakdown;

          if (
            parsed &&
            typeof parsed === "object" &&
            "method" in parsed &&
            "chargeType" in parsed &&
            "calculatedFee" in parsed &&
            typeof parsed.method === "string" &&
            typeof parsed.chargeType === "string" &&
            typeof parsed.calculatedFee === "number"
          ) {
            paymentFeeBreakdown = parsed as {
              method: string;
              chargeType: string;
              calculatedFee: number;
              flatAmount?: number;
              percentage?: number;
              mixMin?: number;
              mixCap?: number;
            };
          }
        } catch (error) {
          this.logger.warn(
            createLogContext(
              this.contextService,
              "OrdersService.findOne.parsePaymentFeeBreakdown",
              {
                orderId,
                error: error instanceof Error ? error.message : String(error),
              },
            ),
            "Failed to parse payment fee breakdown",
          );
        }
      }

      return {
        id: order.id,
        customerId: order.customerId,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: order.subtotal || 0,
        gstAmount: order.gstAmount || 0,
        gstBreakdown,
        shippingCost: order.shippingCost || 0,
        paymentFee: order.paymentFee || undefined,
        paymentMethod: order.paymentMethod || null,
        paymentFeeBreakdown,
        total: order.total || 0,
        razorpayOrderId: order.razorpayOrderId || null,
        shippingProvider: order.shippingProvider || null,
        shippingAddressId: order.shippingAddressId,
        billingAddressId: order.billingAddressId,
        items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        archived: order.archived || false,
        archivedAt: order.archivedAt || null,
        archivedBy: order.archivedBy || null,
        ...(order.discountCode !== null && order.discountCode !== undefined
          ? { discountCode: order.discountCode }
          : {}),
        ...(order.discountAmount !== null && order.discountAmount !== undefined
          ? { discountAmount: order.discountAmount }
          : {}),
      } as OrderResponseDto & {
        discountCode?: string | null;
        discountAmount?: number;
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrdersService.findOne",
          error,
          { orderId, userId },
        ),
        "Failed to get order",
      );
      throw new NotFoundException("Order not found");
    }
  }

  /**
   * Get order by ID (public - for guest orders)
   */
  @Trace({ operation: "OrdersService.findOnePublic" })
  async findOnePublic(orderId: string) {
    try {
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
            "OrdersService.findOnePublic.selectOrder",
            error,
            { orderId },
          ),
          "Failed to fetch order",
        );
        throw new NotFoundException("Order not found");
      }

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Get order items with GST rates
      let items: Array<{
        id: string;
        orderId: string;
        productVariantId: string;
        quantity: number;
        price: number;
        gstRate: number;
        gstAmount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      try {
        items = await this.db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productVariantId: orderItems.productVariantId,
            quantity: orderItems.quantity,
            price: orderItems.price,
            gstRate: orderItems.gstRate,
            gstAmount: orderItems.gstAmount,
            createdAt: orderItems.createdAt,
            updatedAt: orderItems.updatedAt,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "OrdersService.findOnePublic.selectItems",
            error,
            { orderId },
          ),
          "Failed to fetch order items",
        );
        items = [];
      }

      // Get shipping address for GST calculation
      let shippingAddress: { state: string } | undefined;
      try {
        const addressResult = await this.db
          .select({ state: addresses.state })
          .from(addresses)
          .where(eq(addresses.id, order.shippingAddressId))
          .limit(1);
        shippingAddress = addressResult[0];
      } catch (error) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "OrdersService.findOnePublic.selectAddress",
            {
              orderId,
              shippingAddressId: order.shippingAddressId,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to fetch shipping address, using default state",
        );
        shippingAddress = undefined;
      }

      // Calculate GST breakdown
      const sellerState = this.getSellerState();
      const buyerState = shippingAddress?.state || "";

      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      for (const item of items) {
        try {
          const itemSubtotal = item.price * item.quantity;
          const gstBreakdown = calculateGstBreakdown(
            itemSubtotal,
            item.gstRate,
            sellerState,
            buyerState,
          );
          totalCgst += gstBreakdown.cgst;
          totalSgst += gstBreakdown.sgst;
          totalIgst += gstBreakdown.igst;
        } catch (error) {
          this.logger.warn(
            createLogContext(
              this.contextService,
              "OrdersService.findOnePublic.calculateGst",
              {
                orderId,
                itemId: item.id,
                error: error instanceof Error ? error.message : String(error),
              },
            ),
            "Failed to calculate GST for item, skipping",
          );
        }
      }

      const gstBreakdown = {
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        totalGst: order.gstAmount || 0,
        isIntraState: sellerState === buyerState,
      };

      // Validate and parse payment fee breakdown
      let paymentFeeBreakdown:
        | {
            method: string;
            chargeType: string;
            calculatedFee: number;
            flatAmount?: number;
            percentage?: number;
            mixMin?: number;
            mixCap?: number;
          }
        | null
        | undefined = null;

      if (order.paymentFeeBreakdown) {
        try {
          const parsed =
            typeof order.paymentFeeBreakdown === "string"
              ? JSON.parse(order.paymentFeeBreakdown)
              : order.paymentFeeBreakdown;

          if (
            parsed &&
            typeof parsed === "object" &&
            "method" in parsed &&
            "chargeType" in parsed &&
            "calculatedFee" in parsed &&
            typeof parsed.method === "string" &&
            typeof parsed.chargeType === "string" &&
            typeof parsed.calculatedFee === "number"
          ) {
            paymentFeeBreakdown = parsed as {
              method: string;
              chargeType: string;
              calculatedFee: number;
              flatAmount?: number;
              percentage?: number;
              mixMin?: number;
              mixCap?: number;
            };
          }
        } catch (error) {
          this.logger.warn(
            createLogContext(
              this.contextService,
              "OrdersService.findOnePublic.parsePaymentFeeBreakdown",
              {
                orderId,
                error: error instanceof Error ? error.message : String(error),
              },
            ),
            "Failed to parse payment fee breakdown",
          );
        }
      }

      return {
        id: order.id,
        customerId: order.customerId,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: order.subtotal || 0,
        gstAmount: order.gstAmount || 0,
        gstBreakdown,
        shippingCost: order.shippingCost || 0,
        paymentFee: order.paymentFee || undefined,
        paymentMethod: order.paymentMethod || null,
        paymentFeeBreakdown,
        total: order.total || 0,
        razorpayOrderId: order.razorpayOrderId || null,
        shippingProvider: order.shippingProvider || null,
        shippingAddressId: order.shippingAddressId,
        billingAddressId: order.billingAddressId,
        items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        archived: order.archived || false,
        archivedAt: order.archivedAt || null,
        archivedBy: order.archivedBy || null,
        ...(order.discountCode !== null && order.discountCode !== undefined
          ? { discountCode: order.discountCode }
          : {}),
        ...(order.discountAmount !== null && order.discountAmount !== undefined
          ? { discountAmount: order.discountAmount }
          : {}),
      } as OrderResponseDto & {
        discountCode?: string | null;
        discountAmount?: number;
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrdersService.findOnePublic",
          error,
          { orderId },
        ),
        "Failed to get order",
      );
      throw new NotFoundException("Order not found");
    }
  }

  /**
   * Calculate GST breakdown for an order
   */
  /**
   * Calculate GST breakdown for an order
   * @deprecated Use OrderGstService.calculateOrderGstBreakdown instead
   */
  private async calculateOrderGstBreakdown(
    orderId: string,
    shippingAddressId: string,
  ): Promise<{
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    isIntraState: boolean;
  }> {
    return this.gstService.calculateOrderGstBreakdown(
      orderId,
      shippingAddressId,
    );
  }

  /**
   * Get all orders for authenticated customer
   * @param userId - User ID
   * @param status - Optional status filter
   */
  @Trace({ operation: "OrdersService.findAll" })
  async findAll(
    userId: string,
    status?: OrderStatus,
    includeArchived?: boolean,
  ) {
    try {
      const customerId = await this.getCustomerId(userId);

      // Build where conditions
      const conditions = [eq(orders.customerId, customerId)];

      if (status) {
        conditions.push(eq(orders.status, status));
      }

      // Exclude archived orders by default
      if (!includeArchived) {
        conditions.push(eq(orders.archived, false));
      }

      const whereConditions =
        conditions.length > 1 ? and(...conditions) : conditions[0];

      let customerOrders: Array<typeof orders.$inferSelect>;
      try {
        customerOrders = await this.db
          .select()
          .from(orders)
          .where(whereConditions)
          .orderBy(desc(orders.createdAt));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "OrdersService.findAll.selectOrders",
            error,
            { userId, customerId, status },
          ),
          "Failed to fetch orders",
        );
        return [];
      }

      // Get items and GST breakdown for each order
      const ordersWithItems = await Promise.all(
        customerOrders.map(async (order) => {
          try {
            let items: Array<{
              id: string;
              orderId: string;
              productVariantId: string;
              quantity: number;
              price: number;
              gstRate: number;
              gstAmount: number;
              createdAt: Date;
              updatedAt: Date;
            }>;
            try {
              items = await this.db
                .select({
                  id: orderItems.id,
                  orderId: orderItems.orderId,
                  productVariantId: orderItems.productVariantId,
                  quantity: orderItems.quantity,
                  price: orderItems.price,
                  gstRate: orderItems.gstRate,
                  gstAmount: orderItems.gstAmount,
                  createdAt: orderItems.createdAt,
                  updatedAt: orderItems.updatedAt,
                })
                .from(orderItems)
                .where(eq(orderItems.orderId, order.id));
            } catch (error) {
              this.logger.warn(
                createLogContext(
                  this.contextService,
                  "OrdersService.findAll.selectItems",
                  {
                    orderId: order.id,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                ),
                "Failed to fetch order items",
              );
              items = [];
            }

            let gstBreakdown: {
              cgst: number;
              sgst: number;
              igst: number;
              totalGst: number;
              isIntraState: boolean;
            };
            try {
              gstBreakdown = await this.calculateOrderGstBreakdown(
                order.id,
                order.shippingAddressId,
              );
            } catch (error) {
              this.logger.warn(
                createLogContext(
                  this.contextService,
                  "OrdersService.findAll.calculateGst",
                  {
                    orderId: order.id,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                ),
                "Failed to calculate GST breakdown, using defaults",
              );
              gstBreakdown = {
                cgst: 0,
                sgst: 0,
                igst: 0,
                totalGst: order.gstAmount || 0,
                isIntraState: false,
              };
            }

            // Validate and parse payment fee breakdown
            let paymentFeeBreakdown:
              | {
                  method: string;
                  chargeType: string;
                  calculatedFee: number;
                  flatAmount?: number;
                  percentage?: number;
                  mixMin?: number;
                  mixCap?: number;
                }
              | null
              | undefined = null;

            if (order.paymentFeeBreakdown) {
              try {
                const parsed =
                  typeof order.paymentFeeBreakdown === "string"
                    ? JSON.parse(order.paymentFeeBreakdown)
                    : order.paymentFeeBreakdown;

                if (
                  parsed &&
                  typeof parsed === "object" &&
                  "method" in parsed &&
                  "chargeType" in parsed &&
                  "calculatedFee" in parsed &&
                  typeof parsed.method === "string" &&
                  typeof parsed.chargeType === "string" &&
                  typeof parsed.calculatedFee === "number"
                ) {
                  paymentFeeBreakdown = parsed as {
                    method: string;
                    chargeType: string;
                    calculatedFee: number;
                    flatAmount?: number;
                    percentage?: number;
                    mixMin?: number;
                    mixCap?: number;
                  };
                }
              } catch (error) {
                this.logger.warn(
                  createLogContext(
                    this.contextService,
                    "OrdersService.findAll.parsePaymentFeeBreakdown",
                    {
                      orderId: order.id,
                      error:
                        error instanceof Error ? error.message : String(error),
                    },
                  ),
                  "Failed to parse payment fee breakdown",
                );
              }
            }

            return {
              id: order.id,
              customerId: order.customerId,
              orderNumber: order.orderNumber,
              status: order.status,
              subtotal: order.subtotal || 0,
              gstAmount: order.gstAmount || 0,
              gstBreakdown,
              shippingCost: order.shippingCost || 0,
              paymentFee: order.paymentFee || undefined,
              paymentMethod: order.paymentMethod || null,
              paymentFeeBreakdown,
              total: order.total || 0,
              razorpayOrderId: order.razorpayOrderId || null,
              shippingProvider: order.shippingProvider || null,
              shippingAddressId: order.shippingAddressId,
              billingAddressId: order.billingAddressId,
              items,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              archived: order.archived || false,
              archivedAt: order.archivedAt || null,
              archivedBy: order.archivedBy || null,
              ...(order.discountCode !== null &&
              order.discountCode !== undefined
                ? { discountCode: order.discountCode }
                : {}),
              ...(order.discountAmount !== null &&
              order.discountAmount !== undefined
                ? { discountAmount: order.discountAmount }
                : {}),
            } as OrderResponseDto & {
              discountCode?: string | null;
              discountAmount?: number;
            };
          } catch (error) {
            this.logger.error(
              createErrorContext(
                this.contextService,
                "OrdersService.findAll.processOrder",
                error,
                { orderId: order.id },
              ),
              "Failed to process order in findAll",
            );
            // Return minimal order to prevent complete failure
            return {
              id: order.id,
              customerId: order.customerId,
              orderNumber: order.orderNumber,
              status: order.status,
              subtotal: order.subtotal || 0,
              gstAmount: order.gstAmount || 0,
              gstBreakdown: {
                cgst: 0,
                sgst: 0,
                igst: 0,
                totalGst: order.gstAmount || 0,
                isIntraState: false,
              },
              shippingCost: order.shippingCost || 0,
              paymentFee: order.paymentFee || undefined,
              paymentMethod: order.paymentMethod || null,
              paymentFeeBreakdown: null,
              total: order.total || 0,
              razorpayOrderId: order.razorpayOrderId || null,
              shippingProvider: order.shippingProvider || null,
              shippingAddressId: order.shippingAddressId,
              billingAddressId: order.billingAddressId,
              items: [],
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              archived: order.archived || false,
              archivedAt: order.archivedAt || null,
              archivedBy: order.archivedBy || null,
              ...(order.discountCode !== null &&
              order.discountCode !== undefined
                ? { discountCode: order.discountCode }
                : {}),
              ...(order.discountAmount !== null &&
              order.discountAmount !== undefined
                ? { discountAmount: order.discountAmount }
                : {}),
            } as OrderResponseDto & {
              discountCode?: string | null;
              discountAmount?: number;
            };
          }
        }),
      );

      return ordersWithItems;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrdersService.findAll",
          error,
          { userId, status },
        ),
        "Failed to get orders",
      );
      return [];
    }
  }

  // ============================================================================
  // Public API Methods - Order Management
  // ============================================================================

  /**
   * Update order status
   * Validates status transition and updates the order
   */
  @Trace({ operation: "OrdersService.updateStatus" })
  async updateStatus(
    userId: string,
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
  ) {
    return this.statusService.updateStatus(userId, orderId, updateStatusDto);
  }

  // ============================================================================
  // Public API Methods - Order Tracking & Timeline
  // ============================================================================

  /**
   * Get order tracking information
   * Returns order details with shipment tracking information
   */
  @Trace({ operation: "OrdersService.getTracking" })
  async getTracking(
    userId: string,
    orderId: string,
  ): Promise<OrderTrackingDto> {
    return this.timelineService.getTracking(userId, orderId);
  }

  /**
   * Get order timeline
   * Returns chronological list of all events related to the order
   */
  @Trace({ operation: "OrdersService.getTimeline" })
  async getTimeline(
    userId: string,
    orderId: string,
  ): Promise<OrderTimelineDto> {
    return this.timelineService.getTimeline(userId, orderId);
  }

  // ============================================================================
  // Deprecated Methods (delegated to extracted services)
  // These methods are kept for backward compatibility during refactoring
  // ============================================================================

  /**
   * Get customer group ID for a customer
   * @deprecated Use OrderValidationService.getCustomerGroupId instead
   */
  private async getCustomerGroupId(customerId: string): Promise<string | null> {
    return this.validationService.getCustomerGroupId(customerId);
  }

  /**
   * Get price lists for a customer (based on customer group)
   * @deprecated Use OrderPricingService.getPriceListsForCustomer instead
   */
  private async getPriceListsForCustomer(
    customerGroupId: string | null,
  ): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      priority: number;
      isActive: boolean;
      startDate?: Date;
      endDate?: Date;
      items: Array<{
        id: string;
        productVariantId?: string;
        productId?: string;
        categoryId?: string;
        overrideType: "FIXED" | "PERCENTAGE";
        overrideValue: number;
      }>;
    }>
  > {
    return this.pricingService.getPriceListsForCustomer(customerGroupId);
  }

  /**
   * Generate unique order number
   * Format: ORD-YYYY-NNNNNN (e.g., ORD-2025-001234)
   * @deprecated This method will be moved to OrderValidationService
   */
  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;

    // Get the latest order number for this year
    const latestOrders = await this.db
      .select({ orderNumber: orders.orderNumber })
      .from(orders)
      .where(ilike(orders.orderNumber, `${prefix}%`))
      .orderBy(desc(orders.createdAt))
      .limit(1);

    let sequence = 1;
    if (latestOrders.length > 0) {
      const latestNumber = latestOrders[0].orderNumber;
      const sequenceStr = latestNumber.replace(prefix, "");
      const parsedSequence = parseInt(sequenceStr, 10);
      if (!Number.isNaN(parsedSequence)) {
        sequence = parsedSequence + 1;
      }
    }

    // Format sequence as 6-digit number
    const formattedSequence = sequence.toString().padStart(6, "0");
    return `${prefix}${formattedSequence}`;
  }

  /**
   * Get customer ID from user ID
   * @deprecated Use OrderValidationService.getCustomerId instead
   */
  private async getCustomerId(userId: string): Promise<string> {
    return this.validationService.getCustomerId(userId);
  }

  /**
   * Get seller state (default to Maharashtra)
   * @deprecated Use OrderValidationService.getSellerState instead
   */
  private getSellerState(): string {
    return this.validationService.getSellerState();
  }

  /**
   * Validate that addresses belong to the customer
   * @deprecated Use OrderValidationService.getAddresses instead
   */
  private async validateAddresses(
    customerId: string,
    shippingAddressId: string,
    billingAddressId: string,
  ) {
    return this.validationService.getAddresses(
      customerId,
      shippingAddressId,
      billingAddressId,
    );
  }
}
