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
import { PAISE_PER_RUPEE } from "../../../common/constants/currency.constants";
import {
  COD_PAYMENT_METHOD,
  isCodPayment,
} from "../../../common/constants/orders.constants";
import { RETRY_DELAY_MS } from "../../../common/constants/timeout.constants";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { Trace } from "../../../common/tracing/trace.decorator";
import { calculateGstBreakdown } from "../../../common/utils/gst.utils";
import type { Database } from "../../../modules/database/db";
import { CartsService } from "../../carts/carts.service";
import { BundleCartItemMetadata } from "../../carts/dto/bundle-cart-item.dto";
import { AddressesService } from "../../customers/addresses.service";
import { CustomersService } from "../../customers/customers.service";
import { DB_TOKEN } from "../../database/database.module";
import { DiscountsService } from "../../discounts/discounts.service";
import { DiscountSnapshotValidator } from "../../discounts/services/discount-snapshot-validator.service";
import { RulesetBundleService } from "../../discounts/services/ruleset-bundle.service";
import { OrderEventsService } from "../../events/order-events.service";
import {
  OrderCreatedEventPayload,
  OrderPaymentCompletedEventPayload,
} from "../../events/order-events.types";
import { NotificationsService } from "../../notifications/notifications.service";
import { NotificationType } from "../../notifications/types/notification.types";
import { PaymentFeeBreakdownDto } from "../../payments/dto/payment-charge.dto";
import { PaymentsService } from "../../payments/payments.service";
import { PaymentChargeService } from "../../payments/services/payment-charge.service";
import { PricingDriftSeverity } from "../../pricing/audit/pricing-audit.types";
import { runPricingEngine } from "../../pricing/engine/pricing-engine";
import {
  PricingEngineInput,
  PricingSnapshot,
} from "../../pricing/engine/pricing-engine.types";
import { createPricingSnapshot } from "../../pricing/engine/pricing-snapshot.utils";
import { BundlePricingService } from "../../pricing/services/bundle-pricing.service";
import { CustomerGroupService } from "../../pricing/services/customer-group.service";
import { PriceListService } from "../../pricing/services/price-list.service";
import { PricingAuditService } from "../../pricing/services/pricing-audit.service";
import { PricingDriftDetectorService } from "../../pricing/services/pricing-drift-detector.service";
import { PricingHotReloadWatcher } from "../../pricing/services/pricing-hot-reload-watcher.service";
import { PricingSnapshotValidator } from "../../pricing/services/pricing-snapshot-validator.service";
import { CheckoutState } from "../../redis-store/constants/checkout-states";
import { CheckoutMetadata } from "../../redis-store/dto/checkout-metadata.dto";
import {
  PaymentIntent,
  PaymentIntentStatus,
} from "../../redis-store/dto/payment-intent.dto";
import { CheckoutStore } from "../../redis-store/stores/checkout-store";
import { CreateOrderDto } from "../dto/create-order.dto";
import { PricingSnapshotDto } from "../dto/enriched-order-item.dto";
import { OrderResponseDto } from "../dto/order-response.dto";
import { PaymentIntentResponseDto } from "../dto/payment-intent-response.dto";
import {
  isGuestCheckout,
  validateAuthenticatedCheckoutRequirements,
  validateGuestCheckoutRequirements,
} from "./creation/order-creation.helper";
import { OrderDiscountService } from "./discount/order-discount.service";
import { OrderInventoryService } from "./inventory/order-inventory.service";
import { OrderPricingService } from "./pricing/order-pricing.service";
import { OrderValidationService } from "./validation/order-validation.service";

/**
 * Service responsible for order creation operations
 * Handles payment intent creation, COD order creation, and order finalization
 */
@Injectable()
export class OrderCreationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly cartsService: CartsService,
    private readonly customersService: CustomersService,
    private readonly addressesService: AddressesService,
    private readonly discountsService: DiscountsService,
    private readonly discountSnapshotValidator: DiscountSnapshotValidator,
    private readonly bundleService: RulesetBundleService,
    private readonly inventoryService: OrderInventoryService,
    private readonly checkoutStore: CheckoutStore,
    private readonly bundlePricingService: BundlePricingService,
    private readonly pricingHotReloadWatcher: PricingHotReloadWatcher,
    readonly _priceListService: PriceListService,
    readonly _customerGroupService: CustomerGroupService,
    private readonly pricingSnapshotValidator: PricingSnapshotValidator,
    private readonly pricingAuditService: PricingAuditService,
    private readonly pricingDriftDetector: PricingDriftDetectorService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly paymentChargeService: PaymentChargeService,
    private readonly notificationsService: NotificationsService,
    private readonly validationService: OrderValidationService,
    private readonly pricingService: OrderPricingService,
    private readonly discountService: OrderDiscountService,
    private readonly orderEventsService: OrderEventsService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Create payment intent for checkout
   * Orders are now created only after payment confirmation via webhook
   * Supports both authenticated and guest checkout
   */
  @Trace({ operation: "OrderCreationService.create" })
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
        customerId = await this.validationService.getCustomerId(userId);
        validateAuthenticatedCheckoutRequirements(createOrderDto);

        // Extract validated address IDs (guaranteed to exist due to validation)
        const shippingAddrId = createOrderDto.shippingAddressId;
        const billingAddrId = createOrderDto.billingAddressId;

        if (!shippingAddrId || !billingAddrId) {
          throw new BadRequestException(
            "Shipping and billing address IDs are required",
          );
        }

        await this.validationService.getAddresses(
          customerId,
          shippingAddrId,
          billingAddrId,
        );
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
      const sellerState = this.validationService.getSellerState();
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
        bundleLineId: string;
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

      const variantToProductForPricing = new Map(
        variantProductMap.map((v) => [v.variantId, v.productId]),
      );
      const productMapForPricing = new Map(
        productDetails.map((p) => [p.productId, p]),
      );

      // STEP 1: Run pricing engine to get effective prices (before discounts)
      let pricingSnapshot: PricingSnapshot | null = null;
      let effectiveSubtotal = subtotal; // Default to base subtotal

      try {
        // Get customer group for price list resolution
        const customerGroupId = customerId
          ? await this.validationService.getCustomerGroupId(customerId)
          : null;

        // Get active price lists for customer group
        const activePriceLists =
          await this.pricingService.getPriceListsForCustomer(customerGroupId);

        // Build variant pricing input (variants + flattened bundles)
        const variantPricingInput = [
          ...cartItemsWithVariants.map((item) => {
            const productId = variantToProductForPricing.get(
              item.productVariantId,
            );
            const product = productId
              ? productMapForPricing.get(productId)
              : null;
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
      const flattenedBundleItemsForEngine = flattenedBundleVariants.map((v) => {
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
      });

      const cartItemsForEngine = [
        ...variantItemsForEngine,
        ...flattenedBundleItemsForEngine,
      ];

      // Apply discounts using discount service
      const { discountAmount, discountSnapshot } =
        await this.discountService.applyDiscountsToOrder(
          cart.id,
          checkoutSessionId,
          effectiveSubtotal,
          customerId,
          userId,
          discountCode,
          createOrderDto.shippingCost || 0,
          cartItemsForEngine,
          bundleCartItems,
          bundleVariantMapping,
          flattenedBundleVariants,
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
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
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
  @Trace({ operation: "OrderCreationService.createCodOrder" })
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
    const sellerState = this.validationService.getSellerState();
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
      // Validate snapshot and extract discount amount/code
      const snapshotTotal =
        metadata.discountSnapshot.total + totalGstAmount + shippingCost;
      const validationResult =
        await this.discountService.validateDiscountSnapshot(
          checkoutSessionId,
          metadata.discountSnapshot,
          snapshotTotal,
        );
      discountAmount = validationResult.discountAmount;
      discountCode = validationResult.discountCode;
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
      subtotalAfterDiscount +
      totalGstAmount +
      shippingCost +
      paymentFee / PAISE_PER_RUPEE;

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
      await this.discountService.logDiscountSnapshotUsage(
        checkoutSessionId,
        orderId,
        metadata.discountSnapshot,
      );
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
      let pricingSnapshot: PricingSnapshotDto | undefined;

      if (metadata.pricingSnapshot) {
        const variantPrice = metadata.pricingSnapshot.variantPrices.find(
          (vp) => vp.variantId === item.productVariantId,
        );
        if (variantPrice) {
          itemPrice = variantPrice.effectivePrice;

          // Store detailed pricing snapshot in order item metadata
          const basePrice = variantPrice.basePrice;
          const compareAtPrice = variantPrice.compareAtPrice;
          const effectivePrice = variantPrice.effectivePrice;
          const savings = basePrice - effectivePrice;
          const _savingsPercentage =
            basePrice > 0 ? (savings / basePrice) * PAISE_PER_RUPEE : 0;

          pricingSnapshot = {
            basePrice,
            compareAtPrice: compareAtPrice || null,
            appliedSale:
              variantPrice.isOnSale && variantPrice.salePrice
                ? { amount: variantPrice.salePrice, label: "Sale Price" }
                : undefined,
            appliedPriceList:
              variantPrice.appliedPriceListId &&
              variantPrice.appliedPriceListName
                ? {
                    name: variantPrice.appliedPriceListName,
                    amount: basePrice - effectivePrice,
                  }
                : undefined,
            savings,
          };
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
        metadata: pricingSnapshot ? { pricingSnapshot } : undefined,
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

    // Commit inventory atomically (release reservation AND decrement inventory)
    // CRITICAL: This uses atomic Lua script to ensure consistency
    // If this fails, inventory will be out of sync and needs manual reconciliation
    await this.inventoryService.commitOrderInventory(
      cart.id,
      orderId,
      cartItemsWithVariants.map((item) => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
      })),
      bundleCartItems,
      false, // Don't clear checkout lock for COD orders
    );

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
  @Trace({ operation: "OrderCreationService.finalizeOrderFromPayment" })
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
      const sellerState = this.validationService.getSellerState();
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
    const sellerState = this.validationService.getSellerState();
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
        (subtotalAfterDiscount + totalGstAmount + shippingCost) *
          PAISE_PER_RUPEE,
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
      subtotalAfterDiscount +
      totalGstAmount +
      shippingCost +
      paymentFee / PAISE_PER_RUPEE;

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
        await this.discountService.logDiscountSnapshotUsage(
          checkoutSessionId,
          orderId,
          metadata.discountSnapshot,
        );
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
          const customerGroupId =
            await this.validationService.getCustomerGroupId(customerId);
          const currentPriceLists =
            await this.pricingService.getPriceListsForCustomer(customerGroupId);
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

    // Commit inventory atomically (release reservation AND decrement inventory)
    // CRITICAL: This uses atomic Lua script to ensure consistency
    // If this fails, inventory will be out of sync and needs manual reconciliation
    await this.inventoryService.commitOrderInventory(
      cart.id,
      orderId,
      cartItemsWithVariants.map((item) => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
      })),
      bundleCartItems,
      true, // Clear checkout lock after successful commit
    );

    // Clear cart - use cartId from session
    try {
      const cartForClearing = await this.cartsService.getCartById(
        session.cartId,
      );
      if (cartForClearing) {
        await this.cartsService.clearCart(
          metadata.userId,
          cartForClearing.sessionId,
        );
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

  /**
   * Generate unique order number
   * Format: ORD-YYYY-NNNNNN (e.g., ORD-2025-001234)
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
}
