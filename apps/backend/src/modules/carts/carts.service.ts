import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  addresses,
  and,
  cartItems,
  carts,
  customers,
  eq,
  inArray,
  productCollections,
  products,
  productTags,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import { calculateGstBreakdown } from "../../common/utils/gst.utils";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import {
  BundleEligibilityService,
  UserBundleSelection,
} from "../bundles/services/bundle-eligibility.service";
import { DiscountsService } from "../discounts/discounts.service";
import { runDiscountEngine } from "../discounts/engine/discount-engine";
import { DiscountEngineInput } from "../discounts/engine/discount-engine.types";
import { DiscountAuditService } from "../discounts/services/discount-audit.service";
import { DiscountProfiler } from "../discounts/services/discount-profiler.service";
import { HotReloadWatcher } from "../discounts/services/hot-reload-watcher.service";
import { BundlePricingService } from "../pricing/services/bundle-pricing.service";
import { KEY_PATTERNS } from "../redis-store/constants/key-patterns";
import { RedisStoreService } from "../redis-store/redis-store.service";
import { CheckoutStore } from "../redis-store/stores/checkout-store";
import { InventoryStore } from "../redis-store/stores/inventory-store";
import {
  BundleCartItemMetadata,
  FlattenedBundleItemMetadata,
} from "./dto/bundle-cart-item.dto";

@Injectable()
export class CartsService {
  constructor(
    private readonly discountsService: DiscountsService,
    private readonly inventoryStore: InventoryStore,
    private readonly checkoutStore: CheckoutStore,
    readonly _redisStoreService: RedisStoreService,
    private readonly discountAuditService: DiscountAuditService,
    private readonly discountProfiler: DiscountProfiler,
    private readonly hotReloadWatcher: HotReloadWatcher,
    private readonly bundleEligibilityService: BundleEligibilityService,
    private readonly bundlePricingService: BundlePricingService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}
  private readonly CART_EXPIRY_DAYS = 30; // Cart expires after 30 days

  /**
   * Get or create cart for customer or session
   */
  private async getOrCreateCart(
    customerId: string | null,
    sessionId: string | null,
  ) {
    if (customerId) {
      // Customer cart
      let cart: typeof carts.$inferSelect | undefined;
      try {
        const cartResult = await this.db
          .select()
          .from(carts)
          .where(eq(carts.customerId, customerId))
          .limit(1);
        cart = cartResult[0];
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "CartsService.getOrCreateCart.selectCustomerCart",
            error,
            { customerId },
          ),
          "Failed to fetch customer cart",
        );
        throw error;
      }

      if (!cart) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.CART_EXPIRY_DAYS);

        try {
          const cartResult = await this.db
            .insert(carts)
            .values({
              customerId,
              expiresAt,
            })
            .returning();
          cart = cartResult[0];
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "CartsService.getOrCreateCart.insertCustomerCart",
              error,
              { customerId },
            ),
            "Failed to create customer cart",
          );
          throw error;
        }
      }

      return cart;
    } else if (sessionId) {
      // Guest cart
      let cart: typeof carts.$inferSelect | undefined;
      try {
        const cartResult = await this.db
          .select()
          .from(carts)
          .where(eq(carts.sessionId, sessionId))
          .limit(1);
        cart = cartResult[0];
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "CartsService.getOrCreateCart.selectGuestCart",
            error,
            { sessionId },
          ),
          "Failed to fetch guest cart",
        );
        throw error;
      }

      if (!cart) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.CART_EXPIRY_DAYS);

        try {
          const cartResult = await this.db
            .insert(carts)
            .values({
              sessionId,
              expiresAt,
            })
            .returning();
          cart = cartResult[0];
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "CartsService.getOrCreateCart.insertGuestCart",
              error,
              { sessionId },
            ),
            "Failed to create guest cart",
          );
          throw error;
        }
      }

      return cart;
    } else {
      throw new BadRequestException(
        "Either customerId or sessionId must be provided",
      );
    }
  }

  /**
   * Get customer ID from user ID
   */
  private async getCustomerId(userId: string): Promise<string | null> {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);

    return customer?.id || null;
  }

  /**
   * Get seller state (default to Maharashtra for now)
   * TODO: This should come from business configuration
   */
  private getSellerState(): string {
    return process.env.SELLER_STATE || "Maharashtra";
  }

  /**
   * Get buyer state from customer's default address
   */
  private async getBuyerState(
    customerId: string | null,
  ): Promise<string | null> {
    if (!customerId) {
      return null;
    }

    // Get default shipping address
    const [defaultAddress] = await this.db
      .select({ state: addresses.state })
      .from(addresses)
      .where(
        and(
          eq(addresses.customerId, customerId),
          eq(addresses.isDefault, true),
        ),
      )
      .limit(1);

    return defaultAddress?.state || null;
  }

  /**
   * Recalculate cart totals with proper CGST/SGST/IGST calculation and discounts
   */
  private async recalculateCartTotals(
    cartId: string,
    customerId: string | null = null,
  ) {
    // Get all cart items with metadata
    const items = await this.db
      .select({
        id: cartItems.id,
        quantity: cartItems.quantity,
        price: cartItems.price,
        productVariantId: cartItems.productVariantId,
        metadata: cartItems.metadata,
      })
      .from(cartItems)
      .where(eq(cartItems.cartId, cartId));

    // Separate bundle and variant items
    const bundleItems: Array<{
      id: string;
      quantity: number;
      price: number;
      productVariantId: string;
      metadata: unknown;
    }> = [];
    const variantItems: Array<{
      id: string;
      quantity: number;
      price: number;
      productVariantId: string;
      metadata: unknown;
    }> = [];

    for (const item of items) {
      const metadata = item.metadata as BundleCartItemMetadata | null;
      if (metadata?.type === "bundle") {
        bundleItems.push(item);
      } else {
        variantItems.push(item);
      }
    }

    // Get variant items with product info
    const variantItemsWithProducts =
      variantItems.length > 0
        ? await this.db
            .select({
              id: cartItems.id,
              quantity: cartItems.quantity,
              price: cartItems.price,
              productVariantId: cartItems.productVariantId,
              productId: productVariants.productId,
            })
            .from(cartItems)
            .innerJoin(
              productVariants,
              eq(cartItems.productVariantId, productVariants.id),
            )
            .where(
              inArray(
                cartItems.id,
                variantItems.map((i) => i.id),
              ),
            )
        : [];

    // Calculate subtotal (bundles already have unit price calculated)
    const bundleSubtotal = bundleItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const variantSubtotal = variantItemsWithProducts.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const subtotal = bundleSubtotal + variantSubtotal;

    // Get GST rates from products (for variant items)
    const productIds = [
      ...new Set(variantItemsWithProducts.map((item) => item.productId)),
    ];
    let productGstRates: Array<{ id: string; gstRate: number }> = [];

    if (productIds.length > 0) {
      productGstRates = await this.db
        .select({
          id: products.id,
          gstRate: products.gstRate,
        })
        .from(products)
        .where(inArray(products.id, productIds));
    }

    const gstRateMap = new Map(productGstRates.map((p) => [p.id, p.gstRate]));

    // For bundles, get GST rates from their component variants
    // Use first variant's product GST rate for simplicity
    const bundleGstRates = new Map<string, number>();
    for (const bundleItem of bundleItems) {
      const _metadata = bundleItem.metadata as BundleCartItemMetadata;
      // Get first variant's product for GST
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
          bundleGstRates.set(bundleItem.id, product.gstRate);
        }
      }
    }

    // Get buyer state
    const buyerState = await this.getBuyerState(customerId);
    const sellerState = this.getSellerState();

    // Calculate GST breakdown per item
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    // Calculate GST for variant items
    for (const item of variantItemsWithProducts) {
      const gstRate = gstRateMap.get(item.productId) || 0;
      const itemAmount = item.price * item.quantity;

      if (gstRate > 0 && buyerState) {
        const breakdown = calculateGstBreakdown(
          itemAmount,
          gstRate,
          sellerState,
          buyerState,
        );
        totalCgst += breakdown.cgst;
        totalSgst += breakdown.sgst;
        totalIgst += breakdown.igst;
      } else if (gstRate > 0) {
        // No buyer state - use IGST (inter-state)
        const breakdown = calculateGstBreakdown(
          itemAmount,
          gstRate,
          sellerState,
          "", // Empty buyer state triggers inter-state
        );
        totalIgst += breakdown.igst;
      }
    }

    // Calculate GST for bundle items
    for (const bundleItem of bundleItems) {
      const gstRate = bundleGstRates.get(bundleItem.id) || 0;
      const itemAmount = bundleItem.price * bundleItem.quantity;

      if (gstRate > 0 && buyerState) {
        const breakdown = calculateGstBreakdown(
          itemAmount,
          gstRate,
          sellerState,
          buyerState,
        );
        totalCgst += breakdown.cgst;
        totalSgst += breakdown.sgst;
        totalIgst += breakdown.igst;
      } else if (gstRate > 0) {
        const breakdown = calculateGstBreakdown(
          itemAmount,
          gstRate,
          sellerState,
          "",
        );
        totalIgst += breakdown.igst;
      }
    }

    const totalGstAmount = totalCgst + totalSgst + totalIgst;

    // Get cart to check for discount code
    const [cart] = await this.db
      .select({ discountCode: carts.discountCode })
      .from(carts)
      .where(eq(carts.id, cartId))
      .limit(1);

    // Flatten bundles to variant list for discount engine
    const bundleVariantMapping = new Map<string, string[]>(); // bundleLineId -> [variantIds]
    const flattenedBundleItems: Array<{
      id: string;
      productVariantId: string;
      productId: string;
      categoryId: string | null;
      collectionIds: string[];
      tagIds: string[];
      price: number;
      quantity: number;
      bundleLineId?: string; // Track which bundle this belongs to
    }> = [];

    for (const bundleItem of bundleItems) {
      const metadata = bundleItem.metadata as BundleCartItemMetadata;
      const variantQuantities =
        this.bundlePricingService.flattenBundleSelections(
          metadata.selections,
          bundleItem.quantity,
        );

      const bundleVariantIds: string[] = [];
      for (const vq of variantQuantities) {
        // Get variant details
        const [variant] = await this.db
          .select({
            productId: productVariants.productId,
          })
          .from(productVariants)
          .where(eq(productVariants.id, vq.variantId))
          .limit(1);

        if (variant) {
          bundleVariantIds.push(vq.variantId);
          // Get unit price from bundle breakdown (simplified - use bundle unit price / variant count)
          const unitPrice = bundleItem.price / variantQuantities.length;
          flattenedBundleItems.push({
            id: `${bundleItem.id}-${vq.variantId}`, // Unique ID for flattened item
            productVariantId: vq.variantId,
            productId: variant.productId,
            categoryId: null, // Will be fetched below
            collectionIds: [],
            tagIds: [],
            price: unitPrice,
            quantity: vq.quantity,
            bundleLineId: bundleItem.id,
          });
        }
      }
      bundleVariantMapping.set(bundleItem.id, bundleVariantIds);
    }

    // Get all product IDs (variant items + bundle variants)
    const allVariantIds = [
      ...variantItemsWithProducts.map((i) => i.productVariantId),
      ...flattenedBundleItems.map((i) => i.productVariantId),
    ];

    const allVariants = await this.db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
      })
      .from(productVariants)
      .where(inArray(productVariants.id, allVariantIds));

    const variantToProduct = new Map(
      allVariants.map((v) => [v.id, v.productId]),
    );

    const allProductIds = [
      ...new Set([
        ...variantItemsWithProducts.map((i) => i.productId),
        ...allVariants.map((v) => v.productId),
      ]),
    ];

    // Fetch product metadata (collections, tags) for discount engine
    const productDetails = await this.db
      .select({
        productId: products.id,
        categoryId: products.categoryId,
      })
      .from(products)
      .where(inArray(products.id, allProductIds));

    const productMap = new Map(productDetails.map((p) => [p.productId, p]));

    // Fetch collections for products
    const productCollectionData = await this.db
      .select({
        productId: productCollections.productId,
        collectionId: productCollections.collectionId,
      })
      .from(productCollections)
      .where(inArray(productCollections.productId, allProductIds));

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
      .where(inArray(productTags.productId, allProductIds));

    const tagsByProduct = new Map<string, string[]>();
    for (const pt of productTagData) {
      if (!tagsByProduct.has(pt.productId)) {
        tagsByProduct.set(pt.productId, []);
      }
      tagsByProduct.get(pt.productId)?.push(pt.tagId);
    }

    // Build cart items with full metadata for discount engine (variant items + flattened bundles)
    const variantItemsForEngine = variantItemsWithProducts.map((item) => {
      const product = productMap.get(item.productId);
      return {
        id: item.id,
        productVariantId: item.productVariantId,
        productId: item.productId,
        categoryId: product?.categoryId || null,
        collectionIds: collectionsByProduct.get(item.productId) || [],
        tagIds: tagsByProduct.get(item.productId) || [],
        price: item.price,
        quantity: item.quantity,
      };
    });

    // Enrich flattened bundle items with product metadata
    const enrichedFlattenedBundleItems = flattenedBundleItems.map((item) => {
      const productId = variantToProduct.get(item.productVariantId);
      const product = productId ? productMap.get(productId) : null;
      return {
        ...item,
        productId: productId || "",
        categoryId: product?.categoryId || null,
        collectionIds: productId
          ? collectionsByProduct.get(productId) || []
          : [],
        tagIds: productId ? tagsByProduct.get(productId) || [] : [],
      };
    });

    const cartItemsForEngine = [
      ...variantItemsForEngine,
      ...enrichedFlattenedBundleItems,
    ];

    // Fetch eligible discounts using discount engine
    let discountAmount = 0;
    try {
      const userId = customerId
        ? await this.getUserIdFromCustomerId(customerId)
        : undefined;

      // Extract variant IDs from cart items for eligibility filtering
      const variantIds = cartItemsForEngine.map(
        (item) => item.productVariantId,
      );

      // Get eligible discounts (automatic + manual if code exists)
      // Pass variant IDs for Redis eligibility filtering
      const eligibleDiscounts =
        await this.discountsService.getEligibleDiscounts(
          subtotal,
          customerId,
          userId,
          cart?.discountCode || undefined,
          variantIds, // NEW: pass variant IDs for eligibility filtering
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
        const engineInput: DiscountEngineInput = {
          cart: {
            items: cartItemsForEngine,
          },
          customer: customerData,
          discounts: eligibleDiscounts,
          now: new Date(),
        };

        const engineResult = runDiscountEngine(engineInput);
        const engineRuntime = Date.now() - engineStartTime;
        // Cap discount amount to not exceed subtotal (discounts can't be more than the cart value)
        // Also ensure discount is non-negative
        discountAmount = Math.max(
          0,
          Math.min(engineResult.discountTotal, subtotal),
        );

        // Record profiler metrics
        const rulesetVersion = this.hotReloadWatcher.getCurrentVersion();
        const rulesApplied = engineResult.appliedDiscountIds.length;
        this.discountProfiler.recordEngineRun(
          rulesetVersion,
          engineRuntime,
          rulesApplied,
          true, // Cache hit (using in-memory bundle)
        );

        // Log discount engine run
        try {
          await this.discountAuditService.logEngineRun(
            cartId,
            engineResult,
            eligibleDiscounts,
          );
        } catch (error) {
          // Log but don't throw - audit logging failure shouldn't break cart recalculation
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "logDiscountEngineRun",
              error,
              { cartId },
            ),
            "Failed to log discount engine run",
          );
        }
      }
    } catch (error) {
      // Discount engine failed, continue without discount
      // Log error but don't break cart recalculation
      this.logger.error(
        createErrorContext(this.contextService, "runDiscountEngine", error, {
          cartId,
        }),
        "Discount engine error",
      );
      discountAmount = 0;
    }

    // Calculate total after discount (discount applies to subtotal before GST)
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
    const total = subtotalAfterDiscount + totalGstAmount;

    // Update cart totals
    try {
      await this.db
        .update(carts)
        .set({
          subtotal,
          gstAmount: totalGstAmount,
          discountAmount,
          total,
        })
        .where(eq(carts.id, cartId));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CartsService.recalculateCartTotals.updateCart",
          error,
          { cartId },
        ),
        "Failed to update cart totals",
      );
      throw error;
    }

    return {
      subtotal,
      gstAmount: totalGstAmount,
      discountAmount,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      total,
    };
  }

  /**
   * Get user ID from customer ID
   */
  private async getUserIdFromCustomerId(
    customerId: string,
  ): Promise<string | undefined> {
    let customer: { userId: string } | undefined;
    try {
      const customerResult = await this.db
        .select({ userId: customers.userId })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);
      customer = customerResult[0];
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "CartsService.getUserIdFromCustomerId.selectCustomer",
          {
            customerId,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to fetch customer, returning undefined",
      );
      return undefined;
    }

    return customer?.userId || undefined;
  }

  /**
   * Get cart (for customer or session)
   * Automatically reinitializes cart if it's in error state
   */
  @Trace({ operation: "CartsService.getCart" })
  async getCart(userId: string | null, sessionId: string | null) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);
    return this.getCartById(cart.id, customerId);
  }

  /**
   * Get cart by ID
   */
  @Trace({ operation: "CartsService.getCartById" })
  async getCartById(cartId: string, customerId?: string | null) {
    // Get cart from database
    let cart: typeof carts.$inferSelect | undefined;
    try {
      const cartResult = await this.db
        .select()
        .from(carts)
        .where(eq(carts.id, cartId))
        .limit(1);
      cart = cartResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CartsService.getCartById.selectCart",
          error,
          { cartId },
        ),
        "Failed to fetch cart",
      );
      throw new NotFoundException("Cart not found");
    }

    if (!cart) {
      throw new NotFoundException("Cart not found");
    }

    // Use customerId from cart if not provided
    const effectiveCustomerId = customerId || cart.customerId;

    // Get cart items
    let items: Array<typeof cartItems.$inferSelect>;
    try {
      items = await this.db
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, cart.id));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CartsService.getCartById.selectCartItems",
          error,
          { cartId },
        ),
        "Failed to fetch cart items",
      );
      items = [];
    }

    // Hydrate bundle items
    const hydratedItems = await Promise.all(
      items.map(async (item) => {
        const metadata = item.metadata as BundleCartItemMetadata | null;
        if (metadata?.type === "bundle") {
          return this.hydrateBundleItem(item, effectiveCustomerId);
        }
        // Variant item - return as-is with type
        return {
          ...item,
          type: "variant" as const,
          price: Number(item.price),
        };
      }),
    );

    // Recalculate totals and get GST breakdown
    const gstBreakdown = await this.recalculateCartTotals(
      cart.id,
      effectiveCustomerId,
    );

    // Get updated cart
    const [updatedCart] = await this.db
      .select()
      .from(carts)
      .where(eq(carts.id, cart.id))
      .limit(1);

    return {
      ...updatedCart,
      discountCode: updatedCart.discountCode,
      discountAmount: Number(updatedCart.discountAmount || 0),
      gstBreakdown: {
        cgst: gstBreakdown.cgst,
        sgst: gstBreakdown.sgst,
        igst: gstBreakdown.igst,
        totalGst: gstBreakdown.gstAmount,
        isIntraState: gstBreakdown.cgst > 0 || gstBreakdown.sgst > 0,
      },
      items: hydratedItems,
    };
  }

  /**
   * Hydrate bundle cart item with full bundle structure
   */
  private async hydrateBundleItem(
    item: {
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
      createdAt: Date;
      updatedAt: Date;
    },
    customerId: string | null,
  ) {
    const metadata = item.metadata as BundleCartItemMetadata;
    const bundle = await this.bundleEligibilityService.getBundle(
      metadata.bundleId,
    );

    if (!bundle) {
      throw new NotFoundException(`Bundle ${metadata.bundleId} not found`);
    }

    // Validate bundle is still active
    if (!bundle.isActive) {
      throw new BadRequestException(
        `Bundle ${metadata.bundleId} is no longer active`,
      );
    }

    // Get bundle variant breakdown
    const variantBreakdown =
      await this.bundlePricingService.getBundleVariantBreakdown(
        metadata.bundleId,
        metadata.selections,
        item.quantity,
        customerId,
      );

    return {
      id: item.id,
      type: "bundle" as const,
      productVariantId: item.productVariantId,
      bundleId: metadata.bundleId,
      selections: metadata.selections,
      quantity: item.quantity,
      price: Number(item.price),
      unitBundlePrice: Number(item.price),
      bundleVariantBreakdown: variantBreakdown.map((vb) => ({
        variantId: vb.variantId,
        unitPrice: vb.unitPrice,
        quantity: vb.quantity,
      })),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  /**
   * Check if cart has active checkout session (snapshot locked)
   * Cart should only be locked if checkout has progressed to payment intent creation
   * Early checkout states (CREATED, LOCKED) should allow cart modifications
   */
  private async isCartSnapshotLocked(cartId: string): Promise<boolean> {
    try {
      // Check if checkout lock exists
      const isLocked = await this.checkoutStore.isCheckoutLocked(cartId);
      if (!isLocked) {
        return false;
      }

      // Lock exists - check if there's an active checkout session
      // Only lock cart if checkout has progressed to payment intent creation
      const hasActiveSession =
        await this.checkoutStore.hasActiveCheckoutSession(cartId);

      if (!hasActiveSession) {
        // Stale lock - release it and allow cart modifications
        this.logger.warn(
          `Stale checkout lock detected for cartId=${cartId} during cart modification, releasing lock`,
        );
        try {
          await this.checkoutStore.releaseCheckoutLock(cartId);
        } catch (error) {
          this.logger.error(
            `Failed to release stale checkout lock for cartId=${cartId}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
        return false;
      }

      // Check the checkout session state by getting it directly
      // Only lock cart if checkout has progressed to PAYMENT_PENDING or later
      // Early states (CREATED, LOCKED) should allow cart modifications
      const sessionResult = await this.checkoutStore.getSessionByCartId(cartId);
      if (!sessionResult) {
        // No active session found - release lock
        try {
          await this.checkoutStore.releaseCheckoutLock(cartId);
        } catch (error) {
          this.logger.error(
            `Failed to release checkout lock for cartId=${cartId}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
        return false;
      }

      // Import CheckoutState to check session state
      const { CheckoutState } = await import(
        "../redis-store/constants/checkout-states"
      );

      // Only lock cart if checkout has progressed to payment intent creation
      // Allow cart modifications in early checkout states
      const lockingStates = [
        CheckoutState.PAYMENT_PENDING,
        CheckoutState.PAYMENT_CONFIRMED,
        CheckoutState.ORDER_CREATED,
        CheckoutState.COMPLETED,
      ];

      const shouldLock = lockingStates.includes(sessionResult.session.state);

      if (!shouldLock) {
        // Early checkout state - release lock to allow cart modifications
        this.logger.debug(
          `Checkout session for cartId=${cartId} is in early state (${sessionResult.session.state}), allowing cart modifications`,
        );
        try {
          await this.checkoutStore.releaseCheckoutLock(cartId);
        } catch (error) {
          this.logger.error(
            `Failed to release checkout lock for cartId=${cartId}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
        return false;
      }

      return true;
    } catch (error) {
      // If check fails, allow cart update (fail open for availability)
      this.logger.error(
        `Failed to check cart lock status for cartId=${cartId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return false;
    }
  }

  /**
   * Add item to cart (variant or bundle)
   */
  @Trace({ operation: "CartsService.addItem" })
  async addItem(
    userId: string | null,
    sessionId: string | null,
    addItemDto: {
      type?: "variant" | "bundle";
      productVariantId?: string;
      bundleId?: string;
      selections?: UserBundleSelection;
      quantity: number;
    },
  ) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Check if cart has active checkout session (snapshot locked)
    if (await this.isCartSnapshotLocked(cart.id)) {
      throw new ConflictException(
        "Cannot modify cart after payment intent creation. Please start a new checkout.",
      );
    }

    const itemType = addItemDto.type || "variant";

    if (itemType === "bundle") {
      if (!addItemDto.bundleId || !addItemDto.selections) {
        throw new BadRequestException(
          "Bundle ID and selections are required for bundle items",
        );
      }
      return this.addBundleToCart(
        cart.id,
        userId,
        sessionId,
        addItemDto.bundleId,
        addItemDto.selections,
        addItemDto.quantity,
        customerId,
      );
    }

    // Variant item handling (existing logic)
    if (!addItemDto.productVariantId) {
      throw new BadRequestException(
        "Product variant ID is required for variant items",
      );
    }

    // Check if product variant exists and get its price
    let variant:
      | {
          id: string;
          price: number;
          productId: string;
        }
      | undefined;
    try {
      const variantResult = await this.db
        .select({
          id: productVariants.id,
          price: productVariants.price,
          productId: productVariants.productId,
        })
        .from(productVariants)
        .where(eq(productVariants.id, addItemDto.productVariantId))
        .limit(1);
      variant = variantResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CartsService.addItem.selectVariant",
          error,
          { productVariantId: addItemDto.productVariantId },
        ),
        "Failed to fetch product variant",
      );
      throw new NotFoundException("Product variant not found");
    }

    if (!variant) {
      throw new NotFoundException("Product variant not found");
    }

    // Check if item already exists in cart
    const [existingItem] = await this.db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productVariantId, addItemDto.productVariantId),
        ),
      )
      .limit(1);

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + addItemDto.quantity;

      // Check available inventory using InventoryStore
      const availableInventory =
        (await this.inventoryStore.getAvailableInventory(
          addItemDto.productVariantId,
        )) ?? 0;
      const reservedInventory = await this.inventoryStore.getReservedInventory(
        addItemDto.productVariantId,
      );
      const available = availableInventory - reservedInventory;

      if (available < newQuantity) {
        throw new BadRequestException(
          `Insufficient inventory. Available: ${available}`,
        );
      }

      // Reserve new quantity (Lua script handles delta automatically)
      await this.inventoryStore.reserveInventory(
        cart.id,
        addItemDto.productVariantId,
        newQuantity,
      );
      // Refresh TTL for the reservation
      await this.inventoryStore.refreshReservationTTL(
        cart.id,
        addItemDto.productVariantId,
      );

      await this.db
        .update(cartItems)
        .set({ quantity: newQuantity })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      // Reserve inventory (atomic operation - Lua script handles validation)
      // The Lua script will throw BadRequestException if insufficient inventory
      await this.inventoryStore.reserveInventory(
        cart.id,
        addItemDto.productVariantId,
        addItemDto.quantity,
      );
      // Refresh TTL for the reservation
      await this.inventoryStore.refreshReservationTTL(
        cart.id,
        addItemDto.productVariantId,
      );

      // Create new cart item
      await this.db.insert(cartItems).values({
        cartId: cart.id,
        productVariantId: addItemDto.productVariantId,
        quantity: addItemDto.quantity,
        price: variant.price,
      });
    }

    // Recalculate totals
    await this.recalculateCartTotals(cart.id, customerId);

    return this.getCart(userId, sessionId);
  }

  /**
   * Add bundle to cart
   */
  private async addBundleToCart(
    cartId: string,
    userId: string | null,
    sessionId: string | null,
    bundleId: string,
    selections: UserBundleSelection,
    bundleQuantity: number,
    customerId: string | null,
  ) {
    // Get bundle from cache/DB
    const bundle = await this.bundleEligibilityService.getBundle(bundleId);
    if (!bundle) {
      throw new NotFoundException(`Bundle with ID ${bundleId} not found`);
    }

    // Validate bundle is active
    if (!bundle.isActive) {
      throw new BadRequestException(`Bundle ${bundleId} is not active`);
    }

    // Validate selections
    const validationResult =
      await this.bundleEligibilityService.validateUserSelection(
        bundleId,
        selections,
      );
    if (!validationResult.isValid) {
      throw new BadRequestException(
        `Invalid bundle selections: ${validationResult.errors.join(", ")}`,
      );
    }

    // Get pricing breakdown for each variant
    const variantBreakdown =
      await this.bundlePricingService.getBundleVariantBreakdown(
        bundleId,
        selections,
        bundleQuantity,
        customerId,
      );

    // Generate unique bundle group ID to link all items from this bundle instance
    const bundleGroupId = `${bundleId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create a map to track which set each variant belongs to
    const variantToSetId = new Map<string, string>();
    for (const [setId, variantIds] of Object.entries(selections)) {
      for (const variantId of variantIds) {
        variantToSetId.set(variantId, setId);
      }
    }

    // Reserve inventory and create individual cart items for each variant
    for (const breakdown of variantBreakdown) {
      const variantId = breakdown.variantId;
      const quantity = breakdown.quantity;
      const unitPrice = breakdown.unitPrice;

      // Reserve inventory (atomic operation - Lua script handles validation)
      // The Lua script will throw BadRequestException if insufficient inventory
      await this.inventoryStore.reserveInventory(cartId, variantId, quantity);
      await this.inventoryStore.refreshReservationTTL(cartId, variantId);

      // Check if this variant already exists in cart (from previous bundle or direct add)
      const [existingItem] = await this.db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, cartId),
            eq(cartItems.productVariantId, variantId),
          ),
        )
        .limit(1);

      if (existingItem) {
        // Merge with existing item - update quantity and price
        const existingMetadata =
          existingItem.metadata as FlattenedBundleItemMetadata | null;
        const isFromBundle = existingMetadata?.fromBundle === true;

        // If existing item is also from a bundle, we need to decide:
        // Option 1: Merge quantities (additive)
        // Option 2: Keep separate (current implementation)
        // For now, we'll merge quantities if from same bundle group, otherwise keep separate
        if (isFromBundle && existingMetadata.bundleGroupId === bundleGroupId) {
          // Same bundle instance - merge quantities
          const newQuantity = existingItem.quantity + quantity;
          await this.db
            .update(cartItems)
            .set({
              quantity: newQuantity,
              // Update price to weighted average
              price:
                (existingItem.price * existingItem.quantity +
                  unitPrice * quantity) /
                newQuantity,
            })
            .where(eq(cartItems.id, existingItem.id));

          // Update inventory reservation
          await this.inventoryStore.reserveInventory(
            cartId,
            variantId,
            newQuantity,
          );
        } else {
          // Different bundle or regular item - create new cart item
          const metadata: FlattenedBundleItemMetadata = {
            fromBundle: true,
            bundleId,
            bundleTitle: bundle.title,
            bundleGroupId,
            bundleSetId: variantToSetId.get(variantId),
          };

          await this.db.insert(cartItems).values({
            cartId,
            productVariantId: variantId,
            quantity,
            price: unitPrice,
            metadata: metadata as unknown as Record<string, unknown>,
          });
        }
      } else {
        // New variant - create cart item
        const metadata: FlattenedBundleItemMetadata = {
          fromBundle: true,
          bundleId,
          bundleTitle: bundle.title,
          bundleGroupId,
          bundleSetId: variantToSetId.get(variantId),
        };

        await this.db.insert(cartItems).values({
          cartId,
          productVariantId: variantId,
          quantity,
          price: unitPrice,
          metadata: metadata as unknown as Record<string, unknown>,
        });
      }
    }

    // Recalculate totals
    await this.recalculateCartTotals(cartId, customerId);

    return this.getCart(userId, sessionId);
  }

  /**
   * Update cart item quantity
   */
  @Trace({ operation: "CartsService.updateItem" })
  async updateItem(
    userId: string | null,
    sessionId: string | null,
    itemId: string,
    updateDto: { quantity: number },
  ) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Check if cart has active checkout session (snapshot locked)
    if (await this.isCartSnapshotLocked(cart.id)) {
      throw new ConflictException(
        "Cannot modify cart after payment intent creation. Please start a new checkout.",
      );
    }

    // Check if item exists and belongs to cart
    const [item] = await this.db
      .select({
        id: cartItems.id,
        productVariantId: cartItems.productVariantId,
        quantity: cartItems.quantity,
        metadata: cartItems.metadata,
      })
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .limit(1);

    if (!item) {
      throw new NotFoundException("Cart item not found");
    }

    // Bundles are now flattened, so all items are handled the same way
    // Variant item handling
    // Calculate quantity delta
    const delta = updateDto.quantity - item.quantity;

    if (delta > 0) {
      // Increasing quantity - reserve additional inventory
      // Lua script handles delta calculation automatically (newQuantity - existingReservation)
      // The Lua script will throw BadRequestException if insufficient inventory
      await this.inventoryStore.reserveInventory(
        cart.id,
        item.productVariantId,
        updateDto.quantity,
      );
    } else if (delta < 0) {
      // Decreasing quantity - reserve new quantity (Lua script handles release)
      await this.inventoryStore.reserveInventory(
        cart.id,
        item.productVariantId,
        updateDto.quantity,
      );
    }
    // If delta === 0, refresh TTL only

    // Refresh TTL for the reservation
    await this.inventoryStore.refreshReservationTTL(
      cart.id,
      item.productVariantId,
    );

    // Update quantity
    await this.db
      .update(cartItems)
      .set({ quantity: updateDto.quantity })
      .where(eq(cartItems.id, itemId));

    // Recalculate totals
    await this.recalculateCartTotals(cart.id, customerId);

    return this.getCart(userId, sessionId);
  }

  /**
   * Remove item from cart
   */
  @Trace({ operation: "CartsService.removeItem" })
  async removeItem(
    userId: string | null,
    sessionId: string | null,
    itemId: string,
  ) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Check if cart has active checkout session (snapshot locked)
    if (await this.isCartSnapshotLocked(cart.id)) {
      throw new ConflictException(
        "Cannot modify cart after payment intent creation. Please start a new checkout.",
      );
    }

    // Check if item exists and belongs to cart
    const [item] = await this.db
      .select({
        id: cartItems.id,
        productVariantId: cartItems.productVariantId,
        quantity: cartItems.quantity,
        metadata: cartItems.metadata,
      })
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .limit(1);

    if (!item) {
      throw new NotFoundException("Cart item not found");
    }

    // Bundles are now flattened, so all items are handled the same way
    // Release reservation for this variant
    const reservation = await this.inventoryStore.getReservation(
      cart.id,
      item.productVariantId,
    );
    if (reservation !== null && reservation > 0) {
      // Delete individual reservation
      const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
        cart.id,
        item.productVariantId,
      );
      await this.inventoryStore.delete(reservationKey);
      // Decrement aggregated reserved count
      await this.inventoryStore.releaseInventory(
        item.productVariantId,
        reservation,
      );
    }

    // Delete item
    await this.db.delete(cartItems).where(eq(cartItems.id, itemId));

    // Recalculate totals
    await this.recalculateCartTotals(cart.id, customerId);

    return this.getCart(userId, sessionId);
  }

  /**
   * Clear cart
   */
  @Trace({ operation: "CartsService.clearCart" })
  async clearCart(userId: string | null, sessionId: string | null) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Release all inventory reservations before clearing cart
    try {
      await this.inventoryStore.releaseCartReservations(cart.id);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CartsService.clearCart.releaseReservations",
          error,
          { cartId: cart.id },
        ),
        "Failed to release cart reservations during clear",
      );
      // Continue with cart clear even if reservation release fails
    }

    // Delete all cart items
    await this.db.delete(cartItems).where(eq(cartItems.cartId, cart.id));

    // Reset cart totals
    await this.db
      .update(carts)
      .set({
        subtotal: 0,
        gstAmount: 0,
        total: 0,
      })
      .where(eq(carts.id, cart.id));

    return this.getCart(userId, sessionId);
  }

  /**
   * Clear cart by cart ID
   * This is a convenience method that fetches the cart first to get userId/sessionId
   */
  async clearCartById(cartId: string): Promise<void> {
    // Get cart from database to find its customerId/sessionId
    let cart: typeof carts.$inferSelect | undefined;
    try {
      const cartResult = await this.db
        .select()
        .from(carts)
        .where(eq(carts.id, cartId))
        .limit(1);
      cart = cartResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CartsService.clearCartById.selectCart",
          error,
          { cartId },
        ),
        "Failed to fetch cart for clearing",
      );
      throw new NotFoundException("Cart not found");
    }

    if (!cart) {
      throw new NotFoundException("Cart not found");
    }

    let userId: string | null = null;
    let sessionId: string | null = null;

    if (cart.customerId) {
      // Customer cart - get userId from customerId
      userId = (await this.getUserIdFromCustomerId(cart.customerId)) || null;
    } else if (cart.sessionId) {
      // Guest cart - use sessionId
      sessionId = cart.sessionId;
    }

    // Clear the cart using the standard method
    await this.clearCart(userId, sessionId);
  }

  /**
   * Merge guest cart into customer cart on login
   */
  async mergeGuestCart(userId: string, sessionId: string) {
    const customerId = await this.getCustomerId(userId);
    if (!customerId) {
      throw new NotFoundException("Customer profile not found");
    }

    // Get guest cart
    const [guestCart] = await this.db
      .select()
      .from(carts)
      .where(eq(carts.sessionId, sessionId))
      .limit(1);

    if (!guestCart || !guestCart.sessionId) {
      return; // No guest cart to merge
    }

    // Get or create customer cart
    const customerCart = await this.getOrCreateCart(customerId, null);

    // Get guest cart items
    const guestItems = await this.db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, guestCart.id));

    // Merge items
    for (const guestItem of guestItems) {
      // Check if item already exists in customer cart
      const [existingItem] = await this.db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, customerCart.id),
            eq(cartItems.productVariantId, guestItem.productVariantId),
          ),
        )
        .limit(1);

      if (existingItem) {
        // Update quantity (add guest quantity)
        await this.db
          .update(cartItems)
          .set({ quantity: existingItem.quantity + guestItem.quantity })
          .where(eq(cartItems.id, existingItem.id));
      } else {
        // Create new item in customer cart
        await this.db.insert(cartItems).values({
          cartId: customerCart.id,
          productVariantId: guestItem.productVariantId,
          quantity: guestItem.quantity,
          price: guestItem.price,
        });
      }
    }

    // Delete guest cart
    await this.db.delete(carts).where(eq(carts.id, guestCart.id));

    // Recalculate customer cart totals
    await this.recalculateCartTotals(customerCart.id, customerId);
  }

  /**
   * Apply discount code to cart
   */
  @Trace({ operation: "CartsService.applyDiscount" })
  async applyDiscount(
    userId: string | null,
    sessionId: string | null,
    discountCode: string,
  ) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Validate discount
    const userIdForValidation = customerId
      ? await this.getUserIdFromCustomerId(customerId)
      : undefined;

    // Get cart subtotal for validation
    const items = await this.db
      .select({
        price: cartItems.price,
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id));

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const validation = await this.discountsService.validateDiscount(
      discountCode,
      userIdForValidation,
      subtotal,
    );

    if (!validation.isValid || !validation.discount) {
      throw new BadRequestException(
        validation.error || "Invalid discount code",
      );
    }

    // Apply discount code
    await this.db
      .update(carts)
      .set({ discountCode })
      .where(eq(carts.id, cart.id));

    // Recalculate totals with discount
    await this.recalculateCartTotals(cart.id, customerId);

    return this.getCart(userId, sessionId);
  }

  /**
   * Remove discount code from cart
   */
  async removeDiscount(userId: string | null, sessionId: string | null) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Remove discount code
    await this.db
      .update(carts)
      .set({ discountCode: null, discountAmount: 0 })
      .where(eq(carts.id, cart.id));

    // Recalculate totals without discount
    await this.recalculateCartTotals(cart.id, customerId);

    return this.getCart(userId, sessionId);
  }
}
