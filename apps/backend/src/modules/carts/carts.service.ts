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
  desc,
  eq,
  inArray,
  productCollections,
  products,
  productTags,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import {
  DECIMAL_ROUNDING_MULTIPLIER,
  PERCENTAGE_MULTIPLIER,
} from "../../common/constants/currency.constants";
import { ReservationMode } from "../../common/constants/inventory.constants";
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
import { PriceResolutionService } from "../pricing/services/price-resolution.service";
import { ProductEnrichmentService } from "../products/services/product-enrichment.service";
import { RedisStoreService } from "../redis-store/redis-store.service";
import { CheckoutStore } from "../redis-store/stores/checkout-store";
import { FingerprintStore } from "../redis-store/stores/fingerprint-store";
import { InventoryStore } from "../redis-store/stores/inventory-store";
import { StaleMarkerStore } from "../redis-store/stores/stale-marker-store";
import { CART_EXPIRY_DAYS } from "./carts.constants";
import {
  BundleCartItemMetadata,
  FlattenedBundleItemMetadata,
} from "./dto/bundle-cart-item.dto";
import { CartActivityService } from "./services/cart-activity.service";

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
    private readonly fingerprintStore: FingerprintStore,
    private readonly staleMarkerStore: StaleMarkerStore,
    private readonly productEnrichmentService: ProductEnrichmentService,
    private readonly priceResolutionService: PriceResolutionService,
    private readonly cartActivityService: CartActivityService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

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
        expiresAt.setDate(expiresAt.getDate() + CART_EXPIRY_DAYS);

        try {
          const cartResult = await this.db
            .insert(carts)
            .values({
              customerId,
              expiresAt,
              currency: "INR", // Default currency, can be updated later
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
        expiresAt.setDate(expiresAt.getDate() + CART_EXPIRY_DAYS);

        try {
          const cartResult = await this.db
            .insert(carts)
            .values({
              sessionId,
              expiresAt,
              currency: "INR", // Default currency, can be updated later
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

    // Resolve current prices for variant items (with sale prices and price lists)
    const variantItemsWithResolvedPrices = await Promise.all(
      variantItemsWithProducts.map(async (item) => {
        try {
          const resolvedPrice =
            await this.priceResolutionService.resolveVariantPrice({
              variantId: item.productVariantId,
              customerId: customerId || undefined,
              date: new Date(),
            });
          return {
            ...item,
            price: resolvedPrice.finalPrice, // Use resolved price instead of stored price
          };
        } catch (error) {
          this.logger.warn(
            createLogContext(
              this.contextService,
              "CartsService.recalculateCartTotals.resolvePrice",
              {
                variantId: item.productVariantId,
                error: error instanceof Error ? error.message : String(error),
              },
            ),
            "Failed to resolve price, using stored cart price",
          );
          return item; // Fallback to stored price
        }
      }),
    );

    // Calculate subtotal (bundles already have unit price calculated)
    const bundleSubtotal = bundleItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const variantSubtotal = variantItemsWithResolvedPrices.reduce(
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

    // Calculate GST for variant items (using resolved prices)
    for (const item of variantItemsWithResolvedPrices) {
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
      ...variantItemsWithResolvedPrices.map((i) => i.productVariantId),
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
    // Use resolved prices for discount calculation
    const variantItemsForEngine = variantItemsWithResolvedPrices.map((item) => {
      const product = productMap.get(item.productId);
      return {
        id: item.id,
        productVariantId: item.productVariantId,
        productId: item.productId,
        categoryId: product?.categoryId || null,
        collectionIds: collectionsByProduct.get(item.productId) || [],
        tagIds: tagsByProduct.get(item.productId) || [],
        price: item.price, // Resolved price
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

    // Update cart item prices to reflect resolved prices (for consistency)
    // This ensures cart totals match displayed prices
    try {
      for (const item of variantItemsWithResolvedPrices) {
        // Only update if price changed (to avoid unnecessary DB writes)
        if (item.price !== variantItems.find((i) => i.id === item.id)?.price) {
          await this.db
            .update(cartItems)
            .set({ price: item.price })
            .where(eq(cartItems.id, item.id));
        }
      }
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "CartsService.recalculateCartTotals.updateItemPrices",
          {
            cartId,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to update cart item prices, continuing with totals update",
      );
    }

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
  async getCart(
    userId: string | null,
    sessionId: string | null,
    checkoutSessionId?: string | null,
  ) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);
    return this.getCartById(cart.id, customerId, checkoutSessionId);
  }

  /**
   * Get cart by ID
   * Optionally includes checkout session data (shipping cost, payment fee) when checkoutSessionId is provided
   */
  @Trace({ operation: "CartsService.getCartById" })
  async getCartById(
    cartId: string,
    customerId?: string | null,
    checkoutSessionId?: string | null,
  ) {
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
        .select({
          id: cartItems.id,
          cartId: cartItems.cartId,
          productVariantId: cartItems.productVariantId,
          quantity: cartItems.quantity,
          price: cartItems.price,
          metadata: cartItems.metadata,
          state: cartItems.state,
          staleMarkedAt: cartItems.staleMarkedAt,
          reacquiredAt: cartItems.reacquiredAt,
          archivedAt: cartItems.archivedAt,
          createdAt: cartItems.createdAt,
          updatedAt: cartItems.updatedAt,
        })
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

    // Get stale items for this cart
    const staleVariantIds = await this.staleMarkerStore.getStaleItems(cart.id);

    // Extract all variant IDs for enrichment
    const variantIds = items.map((item) => item.productVariantId);

    // Enrich all variants with product data
    const enrichedVariants =
      await this.productEnrichmentService.enrichVariants(variantIds);
    const enrichedVariantsMap = new Map(
      enrichedVariants.map((v) => [v.variantId, v]),
    );

    // Resolve prices for all variants
    const resolvedPricesMap = new Map<
      string,
      Awaited<
        ReturnType<typeof this.priceResolutionService.resolveVariantPrice>
      >
    >();
    for (const variantId of variantIds) {
      try {
        const resolvedPrice =
          await this.priceResolutionService.resolveVariantPrice({
            variantId,
            customerId: effectiveCustomerId || undefined,
            date: new Date(),
          });
        resolvedPricesMap.set(variantId, resolvedPrice);
      } catch (error) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "CartsService.getCartById.resolvePrice",
            {
              variantId,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to resolve price for variant, using cart item price",
        );
      }
    }

    // Build enriched cart items
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const metadata = item.metadata as BundleCartItemMetadata | null;
        const enrichedVariant = enrichedVariantsMap.get(item.productVariantId);
        const resolvedPrice = resolvedPricesMap.get(item.productVariantId);

        if (metadata?.type === "bundle") {
          return await this.buildEnrichedBundleItem(
            item,
            metadata,
            effectiveCustomerId,
            enrichedVariant,
            resolvedPrice,
            staleVariantIds.includes(item.productVariantId),
          );
        }

        // Variant item
        return this.buildEnrichedVariantItem(
          item,
          enrichedVariant,
          resolvedPrice,
          staleVariantIds.includes(item.productVariantId),
        );
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

    // Build warnings array if there are stale items
    const warnings =
      staleVariantIds.length > 0
        ? [
            {
              type: "STALE_ITEMS",
              message: `${staleVariantIds.length} item(s) reservation expired. Availability will be revalidated at checkout.`,
            },
          ]
        : [];

    // Calculate item-level discounts (from sale prices and price lists)
    const itemDiscounts = enrichedItems.reduce((sum, item) => {
      const baseTotal = item.pricing.basePrice * item.quantity;
      const finalTotal = item.pricing.unitPrice * item.quantity;
      return sum + (baseTotal - finalTotal);
    }, 0);

    // Get discount details if discount code exists
    let discountDetails:
      | {
          code: string;
          type: string;
          description: string;
          amountSaved: number;
          percentageSaved: number;
          appliedTo: string;
          eligibleItems?: string[];
        }
      | undefined;

    if (updatedCart.discountCode) {
      try {
        const discount = await this.discountsService.findByCode(
          updatedCart.discountCode,
        );
        const discountAmount = Number(updatedCart.discountAmount || 0);
        const subtotalAfterItemDiscounts =
          Number(updatedCart.subtotal) - itemDiscounts;
        const percentageSaved =
          subtotalAfterItemDiscounts > 0
            ? (discountAmount / subtotalAfterItemDiscounts) *
              PERCENTAGE_MULTIPLIER
            : 0;

        // Map discount type to simpler format
        let mappedType: "percentage" | "fixed" | "buy_x_get_y";
        if (discount.type === "PERCENTAGE") {
          mappedType = "percentage";
        } else if (discount.type === "BUY_X_GET_Y") {
          mappedType = "buy_x_get_y";
        } else {
          mappedType = "fixed";
        }

        discountDetails = {
          code: discount.code,
          type: mappedType,
          description: discount.description || discount.name || discount.code,
          amountSaved: discountAmount,
          percentageSaved:
            Math.round(percentageSaved * DECIMAL_ROUNDING_MULTIPLIER) /
            DECIMAL_ROUNDING_MULTIPLIER,
          appliedTo: discount.appliesTo === "SUBTOTAL" ? "cart" : "items",
          // TODO: Calculate eligible items based on discount scope
        };
      } catch (error) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "CartsService.getCartById.getDiscountDetails",
            {
              discountCode: updatedCart.discountCode,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to fetch discount details",
        );
      }
    }

    // Build price summary
    const subtotal = Number(updatedCart.subtotal);
    const couponDiscount = Number(updatedCart.discountAmount || 0);
    const totalBeforeGst = subtotal - itemDiscounts - couponDiscount;
    const gstAmount = Number(updatedCart.gstAmount || 0);
    const total = Number(updatedCart.total);

    // Fetch checkout session metadata if checkoutSessionId is provided
    let shippingCost: number | undefined;
    let paymentFee: number | undefined;

    if (checkoutSessionId) {
      try {
        const metadata =
          await this.checkoutStore.getCheckoutMetadata(checkoutSessionId);
        if (metadata) {
          shippingCost = metadata.shippingCost;
          // paymentFee is stored in paise, keep it as-is for consistency
          paymentFee = metadata.paymentFee;
        }
      } catch (error) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "CartsService.getCartById.getCheckoutMetadata",
            {
              checkoutSessionId,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to fetch checkout metadata, continuing without shipping/payment fees",
        );
        // Continue without checkout session data - non-critical
      }
    }

    return {
      ...updatedCart,
      discountCode: updatedCart.discountCode,
      discountAmount: couponDiscount,
      gstBreakdown: {
        cgst: gstBreakdown.cgst,
        sgst: gstBreakdown.sgst,
        igst: gstBreakdown.igst,
        totalGst: gstBreakdown.gstAmount,
        isIntraState: gstBreakdown.cgst > 0 || gstBreakdown.sgst > 0,
      },
      items: enrichedItems,
      discount: discountDetails,
      priceSummary: {
        subtotal,
        itemDiscounts,
        couponDiscount,
        totalBeforeGst,
        gstAmount,
        gstBreakdown: {
          cgst: gstBreakdown.cgst,
          sgst: gstBreakdown.sgst,
          igst: gstBreakdown.igst,
          totalGst: gstBreakdown.gstAmount,
          isIntraState: gstBreakdown.cgst > 0 || gstBreakdown.sgst > 0,
        },
        total,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
      shippingCost,
      paymentFee,
    };
  }

  /**
   * Build enriched variant cart item
   */
  private buildEnrichedVariantItem(
    item: {
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      state: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    enrichedVariant:
      | Awaited<
          ReturnType<typeof this.productEnrichmentService.enrichVariants>
        >[0]
      | undefined,
    resolvedPrice:
      | Awaited<
          ReturnType<typeof this.priceResolutionService.resolveVariantPrice>
        >
      | undefined,
    isStale: boolean,
  ) {
    // Fallback to cart item price if enrichment/resolution failed
    const unitPrice = resolvedPrice?.finalPrice ?? Number(item.price);
    const basePrice = resolvedPrice?.basePrice ?? Number(item.price);
    const compareAtPrice = resolvedPrice?.compareAtPrice ?? null;
    const breakdown = resolvedPrice?.breakdown ?? {
      basePrice: Number(item.price),
      totalSavings: 0,
      savingsPercentage: 0,
    };

    return {
      id: item.id,
      type: "variant" as const,
      quantity: item.quantity,
      variantId: item.productVariantId,
      productId: enrichedVariant?.productId || "",
      productTitle: enrichedVariant?.productTitle || "Product",
      productSlug: enrichedVariant?.productSlug || "",
      variantTitle: enrichedVariant?.variantTitle || null,
      sku: enrichedVariant?.sku || "",
      attributes: enrichedVariant?.attributes || {},
      thumbnail: enrichedVariant?.thumbnail || null,
      pricing: {
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        basePrice,
        compareAtPrice,
        breakdown: {
          salePrice: breakdown.salePrice
            ? {
                amount: breakdown.salePrice.amount,
                label: breakdown.salePrice.label || "Sale",
              }
            : undefined,
          priceListDiscount: breakdown.priceListDiscount
            ? {
                amount: breakdown.priceListDiscount.amount,
                listName: breakdown.priceListDiscount.listName,
              }
            : undefined,
          savings: breakdown.totalSavings,
          savingsPercentage: breakdown.savingsPercentage,
        },
      },
      inventoryStatus: enrichedVariant?.inventoryStatus || "out_of_stock",
      availableQuantity: enrichedVariant?.inventoryQuantity || 0,
      gstRate: enrichedVariant?.gstRate || 0,
      state: item.state || "fresh",
      isStale,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  /**
   * Build enriched bundle cart item
   */
  private async buildEnrichedBundleItem(
    item: {
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      state: string | null;
      createdAt: Date;
      updatedAt: Date;
      metadata: unknown;
    },
    metadata: BundleCartItemMetadata,
    customerId: string | null,
    enrichedVariant:
      | Awaited<
          ReturnType<typeof this.productEnrichmentService.enrichVariants>
        >[0]
      | undefined,
    resolvedPrice:
      | Awaited<
          ReturnType<typeof this.priceResolutionService.resolveVariantPrice>
        >
      | undefined,
    isStale: boolean,
  ) {
    const bundle = await this.bundleEligibilityService.getBundle(
      metadata.bundleId,
    );

    if (!bundle) {
      throw new NotFoundException(`Bundle ${metadata.bundleId} not found`);
    }

    // Get bundle variant breakdown
    const variantBreakdown =
      await this.bundlePricingService.getBundleVariantBreakdown(
        metadata.bundleId,
        metadata.selections,
        item.quantity,
        customerId,
      );

    // Use resolved price if available, otherwise use cart item price
    const unitPrice = resolvedPrice?.finalPrice ?? Number(item.price);
    const basePrice = resolvedPrice?.basePrice ?? Number(item.price);
    const compareAtPrice = resolvedPrice?.compareAtPrice ?? null;
    const breakdown = resolvedPrice?.breakdown ?? {
      basePrice: Number(item.price),
      totalSavings: 0,
      savingsPercentage: 0,
    };

    return {
      id: item.id,
      type: "bundle" as const,
      quantity: item.quantity,
      variantId: item.productVariantId,
      productId: enrichedVariant?.productId || "",
      productTitle: enrichedVariant?.productTitle || bundle.title,
      productSlug: enrichedVariant?.productSlug || "",
      variantTitle: enrichedVariant?.variantTitle || null,
      sku: enrichedVariant?.sku || "",
      attributes: enrichedVariant?.attributes || {},
      thumbnail: enrichedVariant?.thumbnail || null,
      pricing: {
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        basePrice,
        compareAtPrice,
        breakdown: {
          salePrice: breakdown.salePrice
            ? {
                amount: breakdown.salePrice.amount,
                label: breakdown.salePrice.label || "Sale",
              }
            : undefined,
          priceListDiscount: breakdown.priceListDiscount
            ? {
                amount: breakdown.priceListDiscount.amount,
                listName: breakdown.priceListDiscount.listName,
              }
            : undefined,
          savings: breakdown.totalSavings,
          savingsPercentage: breakdown.savingsPercentage,
        },
      },
      inventoryStatus: enrichedVariant?.inventoryStatus || "out_of_stock",
      availableQuantity: enrichedVariant?.inventoryQuantity || 0,
      gstRate: enrichedVariant?.gstRate || 0,
      bundleId: metadata.bundleId,
      bundleTitle: bundle.title,
      bundleSetId: undefined, // Will be set if needed
      selections: metadata.selections,
      bundleVariantBreakdown: variantBreakdown.map((vb) => ({
        variantId: vb.variantId,
        unitPrice: vb.unitPrice,
        quantity: vb.quantity,
      })),
      state: item.state || "fresh",
      isStale,
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

    // Enforce fingerprint-based reservation limit (abuse prevention)
    const fingerprint = this.contextService.getValue("fingerprint");
    if (fingerprint) {
      try {
        // Check if this cart already has reservations tracked for this fingerprint
        const activeCartIds =
          await this.fingerprintStore.getActiveCartIds(fingerprint);
        const isNewCart = !activeCartIds.includes(cart.id);

        // Only enforce limit if this is a new cart for this fingerprint
        if (isNewCart) {
          await this.fingerprintStore.enforceReservationLimit(fingerprint);
        }

        // Track this cart's reservation for the fingerprint
        await this.fingerprintStore.addReservation(fingerprint, cart.id);
      } catch (error) {
        // If it's a BadRequestException (limit exceeded), rethrow it
        if (error instanceof BadRequestException) {
          throw error;
        }
        // Log other errors but continue - fingerprint tracking is non-critical
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "addItem.fingerprintEnforcement",
            error,
            { fingerprint },
          ),
          "Failed to enforce fingerprint reservation limit (non-critical)",
        );
      }
    }

    // Enforce one cart per authenticated user (merge multiple carts if they exist)
    if (userId) {
      try {
        await this.enforceOneCartPerUser(userId);
        // Re-fetch cart after merge (cart ID might have changed)
        const mergedCart = await this.getOrCreateCart(customerId, sessionId);
        if (mergedCart.id !== cart.id) {
          // Cart was merged - use the merged cart
          return this.addItem(userId, sessionId, addItemDto);
        }
      } catch (error) {
        // Log but continue - merge failure shouldn't block add item
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "addItem.enforceOneCartPerUser",
            error,
            { userId },
          ),
          "Failed to enforce one cart per user (non-critical)",
        );
      }
    }

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

    // Check stock level (no reservation at cart time - race-to-checkout model)
    const stockCheck = await this.inventoryStore.checkStockLevel(
      addItemDto.productVariantId,
    );

    if (!stockCheck.canAdd) {
      throw new BadRequestException(
        "This item is currently out of stock. Please try again later.",
      );
    }

    let reservationWarning: string | undefined;
    if (stockCheck.warning) {
      reservationWarning = stockCheck.warning;
    }

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + addItemDto.quantity;

      // Update quantity and set state to FRESH (clearing any stale state)
      await this.db
        .update(cartItems)
        .set({
          quantity: newQuantity,
          state: "fresh",
          staleMarkedAt: null,
        })
        .where(eq(cartItems.id, existingItem.id));

      // Clear stale marker if it exists
      await this.staleMarkerStore.clearStaleMarker(
        cart.id,
        addItemDto.productVariantId,
      );
    } else {
      // Create new cart item with FRESH state
      await this.db.insert(cartItems).values({
        cartId: cart.id,
        productVariantId: addItemDto.productVariantId,
        quantity: addItemDto.quantity,
        price: variant.price,
        state: "fresh",
      });

      // Clear stale marker if it exists (in case item was previously stale)
      await this.staleMarkerStore.clearStaleMarker(
        cart.id,
        addItemDto.productVariantId,
      );
    }

    // Recalculate totals
    await this.recalculateCartTotals(cart.id, customerId);

    const cartResponse = await this.getCart(userId, sessionId);

    // Return cart with warning metadata if applicable
    if (reservationWarning) {
      return {
        ...cartResponse,
        warnings: [
          {
            type: "LOW_STOCK",
            variantId: addItemDto.productVariantId,
            message: reservationWarning,
          },
        ],
      } as typeof cartResponse & {
        warnings?: Array<{ type: string; variantId: string; message: string }>;
      };
    }

    return cartResponse;
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

    // Check stock levels and create individual cart items for each variant
    // No reservation at cart time - race-to-checkout model
    const bundleWarnings: Array<{
      type: string;
      variantId: string;
      message: string;
    }> = [];
    for (const breakdown of variantBreakdown) {
      const variantId = breakdown.variantId;
      const quantity = breakdown.quantity;
      const unitPrice = breakdown.unitPrice;

      // Check stock level (no reservation at cart time)
      const stockCheck = await this.inventoryStore.checkStockLevel(variantId);
      if (!stockCheck.canAdd) {
        throw new BadRequestException(
          `Variant ${variantId} is currently out of stock and cannot be added to bundle.`,
        );
      }

      if (stockCheck.warning) {
        bundleWarnings.push({
          type: "LOW_STOCK",
          variantId,
          message: stockCheck.warning,
        });
      }

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
              state: "fresh",
              staleMarkedAt: null,
            })
            .where(eq(cartItems.id, existingItem.id));

          // Clear stale marker if it exists
          await this.staleMarkerStore.clearStaleMarker(cartId, variantId);
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
            state: "fresh",
          });

          // Clear stale marker if it exists
          await this.staleMarkerStore.clearStaleMarker(cartId, variantId);
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
          state: "fresh",
        });

        // Clear stale marker if it exists
        await this.staleMarkerStore.clearStaleMarker(cartId, variantId);
      }
    }

    // Recalculate totals
    await this.recalculateCartTotals(cartId, customerId);

    const cartResponse = await this.getCart(userId, sessionId);

    // Return cart with warnings if any
    if (bundleWarnings.length > 0) {
      return {
        ...cartResponse,
        warnings: bundleWarnings,
      } as typeof cartResponse & {
        warnings?: Array<{ type: string; variantId: string; message: string }>;
      };
    }

    return cartResponse;
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
    // Check stock level (no reservation at cart time - race-to-checkout model)
    const stockCheck = await this.inventoryStore.checkStockLevel(
      item.productVariantId,
    );

    if (!stockCheck.canAdd) {
      throw new BadRequestException(
        "This item is currently out of stock. Please try again later.",
      );
    }

    let reservationWarning: string | undefined;
    if (stockCheck.warning) {
      reservationWarning = stockCheck.warning;
    }

    // Update quantity and set state to FRESH (clearing any stale state)
    await this.db
      .update(cartItems)
      .set({
        quantity: updateDto.quantity,
        state: "fresh",
        staleMarkedAt: null,
      })
      .where(eq(cartItems.id, itemId));

    // Clear stale marker if it exists
    await this.staleMarkerStore.clearStaleMarker(
      cart.id,
      item.productVariantId,
    );

    // Recalculate totals
    await this.recalculateCartTotals(cart.id, customerId);

    // Track activity
    await this.cartActivityService.trackActivity({
      cartId: cart.id,
      customerId,
      sessionId,
      activityType: "quantity_updated",
      metadata: {
        itemId,
        productVariantId: item.productVariantId,
        oldQuantity: item.quantity,
        newQuantity: updateDto.quantity,
      },
    });

    const cartResponse = await this.getCart(userId, sessionId);

    // Return cart with warning metadata if applicable
    if (reservationWarning) {
      return {
        ...cartResponse,
        warnings: [
          {
            type: "LOW_STOCK",
            variantId: item.productVariantId,
            message: reservationWarning,
          },
        ],
      } as typeof cartResponse & {
        warnings?: Array<{ type: string; variantId: string; message: string }>;
      };
    }

    return cartResponse;
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
    // Release reservation using atomic Lua script
    // Check if soft reserved counter exists to determine mode
    const softReservedKey = `inventory:soft_reserved:${item.productVariantId}`;
    const hasSoftReservation =
      await this.inventoryStore.exists(softReservedKey);
    const mode = (hasSoftReservation ? "soft" : "hard") as ReservationMode;

    try {
      await this.inventoryStore.releaseInventoryAtomic(
        cart.id,
        item.productVariantId,
        mode,
      );
    } catch (error) {
      // Log but continue - release failure shouldn't block item removal
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "removeItem.releaseInventory",
          error,
          { cartId: cart.id, variantId: item.productVariantId },
        ),
        "Failed to release inventory during item removal (non-critical)",
      );
    }

    // Delete item
    await this.db.delete(cartItems).where(eq(cartItems.id, itemId));

    // Check if cart is now empty - if so, remove fingerprint tracking
    const remainingItems = await this.db
      .select({ id: cartItems.id })
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id))
      .limit(1);

    if (remainingItems.length === 0) {
      const fingerprint = this.contextService.getValue("fingerprint");
      if (fingerprint) {
        try {
          await this.fingerprintStore.removeReservation(fingerprint, cart.id);
        } catch (error) {
          // Log but don't throw - fingerprint tracking is non-critical
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "removeItem.removeFingerprintReservation",
              error,
              { fingerprint, cartId: cart.id },
            ),
            "Failed to remove fingerprint reservation (non-critical)",
          );
        }
      }
    }

    // Recalculate totals
    await this.recalculateCartTotals(cart.id, customerId);

    // Track activity
    await this.cartActivityService.trackActivity({
      cartId: cart.id,
      customerId,
      sessionId,
      activityType: "item_removed",
      metadata: {
        itemId,
        productVariantId: item.productVariantId,
      },
    });

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

    // Remove fingerprint tracking for this cart
    const fingerprint = this.contextService.getValue("fingerprint");
    if (fingerprint) {
      try {
        await this.fingerprintStore.removeReservation(fingerprint, cart.id);
      } catch (error) {
        // Log but don't throw - fingerprint tracking is non-critical
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "clearCart.removeFingerprintReservation",
            error,
            { fingerprint, cartId: cart.id },
          ),
          "Failed to remove fingerprint reservation (non-critical)",
        );
      }
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
   * Enforce one cart per authenticated user
   * Merges multiple carts into the newest cart and releases duplicate reservations
   */
  async enforceOneCartPerUser(userId: string): Promise<void> {
    const customerId = await this.getCustomerId(userId);
    if (!customerId) {
      return; // No customer profile - skip merging
    }

    // Find all carts for this customer
    const userCarts = await this.db
      .select()
      .from(carts)
      .where(eq(carts.customerId, customerId))
      .orderBy(desc(carts.updatedAt)); // Newest first

    if (userCarts.length <= 1) {
      return; // Only one cart or no carts - nothing to merge
    }

    // Use the newest cart as the target
    const targetCart = userCarts[0];
    const cartsToMerge = userCarts.slice(1);

    this.logger.debug(
      createLogContext(this.contextService, "enforceOneCartPerUser", {
        userId,
        customerId,
        targetCartId: targetCart.id,
        cartsToMerge: cartsToMerge.length,
      }),
      `Merging ${cartsToMerge.length} carts into cart ${targetCart.id}`,
    );

    // Merge items from other carts into target cart
    for (const cartToMerge of cartsToMerge) {
      const itemsToMerge = await this.db
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, cartToMerge.id));

      for (const item of itemsToMerge) {
        // Check if item already exists in target cart
        const [existingItem] = await this.db
          .select()
          .from(cartItems)
          .where(
            and(
              eq(cartItems.cartId, targetCart.id),
              eq(cartItems.productVariantId, item.productVariantId),
            ),
          )
          .limit(1);

        if (existingItem) {
          // Merge quantities and release old reservation
          const newQuantity = existingItem.quantity + item.quantity;

          // Release reservation from old cart (if exists - for legacy carts)
          // No new reservation needed - race-to-checkout model
          try {
            const reservation = await this.inventoryStore.getReservation(
              cartToMerge.id,
              item.productVariantId,
            );
            if (reservation !== null && reservation > 0) {
              const softReservedKey = `inventory:soft_reserved:${item.productVariantId}`;
              const hasSoftReservation =
                await this.inventoryStore.exists(softReservedKey);
              const mode = (
                hasSoftReservation ? "soft" : "hard"
              ) as ReservationMode;
              await this.inventoryStore.releaseInventoryAtomic(
                cartToMerge.id,
                item.productVariantId,
                mode,
              );
            }
          } catch (error) {
            this.logger.warn(
              createErrorContext(
                this.contextService,
                "enforceOneCartPerUser.releaseOldReservation",
                error,
                { oldCartId: cartToMerge.id, variantId: item.productVariantId },
              ),
              "Failed to release old reservation during merge (non-critical)",
            );
          }

          // Update quantity in target cart
          await this.db
            .update(cartItems)
            .set({ quantity: newQuantity })
            .where(eq(cartItems.id, existingItem.id));
        } else {
          // Release reservation from old cart if exists (for legacy carts)
          // No new reservation needed - race-to-checkout model
          try {
            const reservation = await this.inventoryStore.getReservation(
              cartToMerge.id,
              item.productVariantId,
            );

            if (reservation !== null && reservation > 0) {
              // Release from old cart
              const softReservedKey = `inventory:soft_reserved:${item.productVariantId}`;
              const hasSoftReservation =
                await this.inventoryStore.exists(softReservedKey);
              const mode = (
                hasSoftReservation ? "soft" : "hard"
              ) as ReservationMode;
              await this.inventoryStore.releaseInventoryAtomic(
                cartToMerge.id,
                item.productVariantId,
                mode,
              );
            }
          } catch (error) {
            this.logger.warn(
              createErrorContext(
                this.contextService,
                "enforceOneCartPerUser.releaseOldReservation",
                error,
                {
                  oldCartId: cartToMerge.id,
                  targetCartId: targetCart.id,
                  variantId: item.productVariantId,
                },
              ),
              "Failed to release old reservation during merge (non-critical)",
            );
            // Continue - item will be added without reservation
          }

          // Create new item in target cart
          await this.db.insert(cartItems).values({
            cartId: targetCart.id,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            price: item.price,
            metadata: item.metadata,
          });
        }
      }

      // Release all remaining reservations from old cart (cleanup)
      try {
        await this.inventoryStore.releaseCartReservations(cartToMerge.id);
      } catch (error) {
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "enforceOneCartPerUser.releaseRemainingReservations",
            error,
            { oldCartId: cartToMerge.id },
          ),
          "Failed to release remaining reservations from old cart",
        );
      }

      // Delete old cart
      await this.db.delete(carts).where(eq(carts.id, cartToMerge.id));
    }

    // Recalculate totals for merged cart
    await this.recalculateCartTotals(targetCart.id, customerId);

    this.logger.info(
      createLogContext(this.contextService, "enforceOneCartPerUser", {
        userId,
        customerId,
        targetCartId: targetCart.id,
        mergedCarts: cartsToMerge.length,
      }),
      `Successfully merged ${cartsToMerge.length} carts into cart ${targetCart.id}`,
    );
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

    // Track activity
    await this.cartActivityService.trackActivity({
      cartId: cart.id,
      customerId,
      sessionId,
      activityType: "discount_applied",
      metadata: {
        discountCode,
      },
    });

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

    // Track activity
    await this.cartActivityService.trackActivity({
      cartId: cart.id,
      customerId,
      sessionId,
      activityType: "discount_removed",
      metadata: {},
    });

    return this.getCart(userId, sessionId);
  }

  /**
   * Update cart currency
   */
  async updateCurrency(
    userId: string | null,
    sessionId: string | null,
    currency: string,
  ) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Update cart currency
    await this.db
      .update(carts)
      .set({
        currency,
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cart.id));

    // Recalculate totals with new currency
    await this.recalculateCartTotals(cart.id, customerId);

    return this.getCart(userId, sessionId);
  }
}
