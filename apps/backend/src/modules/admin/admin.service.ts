import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  addresses,
  and,
  carts,
  customers,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  orderItems,
  orders,
  products,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { calculateGstBreakdown } from "../../common/utils/gst.utils";
import type { Database } from "../../modules/database/db";
import { CartsService } from "../carts/carts.service";
import { DB_TOKEN } from "../database/database.module";
import { OrderResponseDto } from "../orders/dto/order-response.dto";
import { ProductsService } from "../products/products.service";
import { CheckoutState } from "../redis-store/constants/checkout-states";
import { RedisStoreService } from "../redis-store/redis-store.service";
import { CheckoutStore } from "../redis-store/stores/checkout-store";
import {
  AbandonedCheckoutResponse,
  AdminQueryAbandonedCheckoutsDto,
  PaginatedAbandonedCheckoutsResponseDto,
} from "./dto/admin-abandoned-checkouts.dto";
import { AdminQueryCustomersDto } from "./dto/admin-customers.dto";
import { AdminQueryOrdersDto } from "./dto/admin-orders.dto";
import { AdminQueryProductsDto } from "./dto/admin-products.dto";
import { AdminStatsResponseDto } from "./dto/admin-stats.dto";
import {
  BulkProductOperation,
  BulkProductOperationDto,
} from "./dto/bulk-operations.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly productsService: ProductsService,
    readonly _cartsService: CartsService,
    private readonly checkoutStore: CheckoutStore,
    private readonly redisStoreService: RedisStoreService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get all products (admin view)
   * Similar to ProductsService.findAll but without public restrictions
   */
  async getAllProducts(query: AdminQueryProductsDto) {
    // Reuse ProductsService logic but ensure admin has access to all products
    return this.productsService.findAll(query);
  }

  /**
   * Get all orders with filters (admin view)
   */
  async getAllOrders(query: AdminQueryOrdersDto) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      // Build where conditions
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle ORM condition array type
      const conditions: any[] = [];

      // Status filter
      if (query.status) {
        conditions.push(eq(orders.status, query.status));
      }

      // Date range filters
      if (query.startDate) {
        const startDate = new Date(query.startDate);
        if (Number.isNaN(startDate.getTime())) {
          this.logger.warn(
            createLogContext(
              this.contextService,
              "getAllOrders.invalidStartDate",
              {
                query,
                startDate: query.startDate,
              },
            ),
            "Invalid start date provided, ignoring filter",
          );
        } else {
          conditions.push(gte(orders.createdAt, startDate));
        }
      }
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        if (Number.isNaN(endDate.getTime())) {
          this.logger.warn(
            createLogContext(
              this.contextService,
              "getAllOrders.invalidEndDate",
              {
                query,
                endDate: query.endDate,
              },
            ),
            "Invalid end date provided, ignoring filter",
          );
        } else {
          conditions.push(lte(orders.createdAt, endDate));
        }
      }

      // Archive filter - exclude archived orders by default
      if (query.archived === undefined || query.archived === false) {
        conditions.push(eq(orders.archived, false));
      } else if (query.archived === true) {
        // If explicitly requesting archived orders, include only archived
        conditions.push(eq(orders.archived, true));
      }

      // Build final where condition
      let whereCondition: ReturnType<typeof and> | undefined;
      if (conditions.length > 0) {
        whereCondition = and(...conditions);
      }

      // Get total count using COUNT(*) for performance
      let total = 0;
      try {
        const countQuery = whereCondition
          ? this.db
              .select({ count: sql<number>`count(*)` })
              .from(orders)
              .where(whereCondition)
          : this.db.select({ count: sql<number>`count(*)` }).from(orders);
        const countResult = await countQuery;
        total = Number(countResult[0]?.count || 0);
      } catch (error) {
        this.logger.error(
          createErrorContext(this.contextService, "getAllOrders.count", error, {
            query,
            whereCondition: whereCondition ? "present" : "none",
            errorMessage:
              error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
          }),
          "Failed to count orders",
        );
        throw new InternalServerErrorException(
          `Failed to retrieve orders count: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Get orders with pagination
      let allOrders: Array<typeof orders.$inferSelect>;
      try {
        const ordersQuery = whereCondition
          ? this.db.select().from(orders).where(whereCondition)
          : this.db.select().from(orders);
        allOrders = await ordersQuery
          .limit(limit)
          .offset(offset)
          .orderBy(desc(orders.createdAt));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "getAllOrders.select",
            error,
            {
              query,
              whereCondition: whereCondition ? "present" : "none",
              errorMessage:
                error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
            },
          ),
          "Failed to select orders",
        );
        throw new InternalServerErrorException(
          `Failed to retrieve orders: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Get items and GST breakdown for each order
      if (!Array.isArray(allOrders)) {
        this.logger.error(
          createLogContext(this.contextService, "getAllOrders.invalidOrders", {
            query,
            allOrdersType: typeof allOrders,
          }),
          "Invalid orders result from database",
        );
        throw new InternalServerErrorException(
          "Invalid orders result from database",
        );
      }

      const ordersWithItems = await Promise.all(
        allOrders.map(async (order) => {
          try {
            // Get order items with explicit field selection
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
              this.logger.error(
                createErrorContext(
                  this.contextService,
                  "getAllOrders.items",
                  error,
                  { orderId: order.id },
                ),
                "Failed to fetch order items",
              );
              // Continue with empty items array instead of failing
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
                createLogContext(this.contextService, "getAllOrders.address", {
                  orderId: order.id,
                  shippingAddressId: order.shippingAddressId,
                  error: error instanceof Error ? error.message : String(error),
                }),
                "Failed to fetch shipping address, using default state",
              );
              shippingAddress = undefined;
            }

            // Calculate GST breakdown
            const sellerState = "Maharashtra"; // Assuming seller is in Maharashtra
            const buyerState = shippingAddress?.state || ""; // Handle undefined shippingAddress

            let totalCgst = 0;
            let totalSgst = 0;
            let totalIgst = 0;

            // Calculate GST for each item
            for (const item of items) {
              try {
                const gstBreakdown = calculateGstBreakdown(
                  item.price * item.quantity,
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
                    "getAllOrders.gstCalculation",
                    {
                      orderId: order.id,
                      itemId: item.id,
                      error:
                        error instanceof Error ? error.message : String(error),
                    },
                  ),
                  "Failed to calculate GST for item, skipping",
                );
                // Continue processing other items
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

                // Validate structure
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
                } else {
                  this.logger.warn(
                    createLogContext(
                      this.contextService,
                      "getAllOrders.paymentFeeBreakdown",
                      {
                        orderId: order.id,
                        paymentFeeBreakdown: JSON.stringify(
                          order.paymentFeeBreakdown,
                        ),
                      },
                    ),
                    "Invalid payment fee breakdown structure",
                  );
                }
              } catch (error) {
                this.logger.warn(
                  createLogContext(
                    this.contextService,
                    "getAllOrders.paymentFeeBreakdown",
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

            // Build order response with all required fields
            // Note: discountCode and discountAmount exist in DB but are not in OrderResponseDto
            // They will be included via object spread but won't be typed
            const orderResponse: OrderResponseDto = {
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
              // Include discount fields from order (exist in DB schema)
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

            return orderResponse;
          } catch (error) {
            this.logger.error(
              createErrorContext(
                this.contextService,
                "getAllOrders.processOrder",
                error,
                { orderId: order.id },
              ),
              "Failed to process order",
            );
            // Return a minimal order response to prevent complete failure
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
              // Include discount fields from order
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

      const totalPages = Math.ceil(total / limit);

      return {
        data: ordersWithItems,
        total: Number(total),
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getAllOrders", error, {
          query,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          errorName: error instanceof Error ? error.name : undefined,
        }),
        "Failed to get all orders",
      );
      // If it's already an InternalServerErrorException, rethrow it
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to retrieve orders. Please try again later. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all customers with search (admin view)
   */
  async getAllCustomers(query: AdminQueryCustomersDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: ReturnType<typeof or | typeof ilike>[] = [];

    // Search condition (name, email, or phone)
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      const searchCondition = or(
        ilike(customers.name, searchPattern),
        ilike(customers.email, searchPattern),
        ilike(customers.phone, searchPattern),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Build final where condition
    let whereCondition: ReturnType<typeof and> | undefined;
    if (conditions.length > 0) {
      whereCondition = and(...conditions);
    }

    // Get total count
    const countQuery = whereCondition
      ? this.db.select().from(customers).where(whereCondition)
      : this.db.select().from(customers);
    const allCustomersForCount = await countQuery;
    const total = allCustomersForCount.length;

    // Get customers with pagination
    const customersQuery = whereCondition
      ? this.db.select().from(customers).where(whereCondition)
      : this.db.select().from(customers);
    const allCustomers = await customersQuery
      .limit(limit)
      .offset(offset)
      .orderBy(desc(customers.createdAt));

    const totalPages = Math.ceil(total / limit);

    return {
      data: allCustomers,
      total: Number(total),
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<AdminStatsResponseDto> {
    // Get total products
    const allProducts = await this.db.select().from(products);
    const totalProducts = allProducts.length;
    const activeProducts = allProducts.filter(
      (p) => p.status === "active",
    ).length;

    // Get total orders
    const allOrders = await this.db.select().from(orders);
    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter(
      (o) => o.status === "pending",
    ).length;

    // Calculate total revenue
    const totalRevenue = allOrders.reduce((sum, order) => sum + order.total, 0);

    // Calculate monthly revenue (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= startOfMonth,
    );
    const monthlyRevenue = monthlyOrders.reduce(
      (sum, order) => sum + order.total,
      0,
    );

    // Calculate average order value
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get total customers
    const allCustomers = await this.db.select().from(customers);
    const totalCustomers = allCustomers.length;

    return {
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      totalCustomers,
      totalRevenue,
      monthlyRevenue,
      averageOrderValue,
    };
  }

  /**
   * Perform bulk operations on products
   */
  async bulkProductOperation(
    dto: BulkProductOperationDto,
  ): Promise<{ affected: number; operation: string; message: string }> {
    const { productIds, operation } = dto;

    // Verify products exist
    const existingProducts = await this.db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    if (existingProducts.length !== productIds.length) {
      throw new Error("Some products not found");
    }

    let affected = 0;

    switch (operation) {
      case BulkProductOperation.ACTIVATE:
        await this.db
          .update(products)
          .set({ status: "active", updatedAt: new Date() })
          .where(inArray(products.id, productIds));
        affected = productIds.length;
        break;

      case BulkProductOperation.ARCHIVE:
        await this.db
          .update(products)
          .set({ status: "archived", updatedAt: new Date() })
          .where(inArray(products.id, productIds));
        affected = productIds.length;
        break;

      case BulkProductOperation.DELETE:
        // Note: In production, you might want to soft delete instead
        await this.db.delete(products).where(inArray(products.id, productIds));
        affected = productIds.length;
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      affected,
      operation,
      message: `Successfully ${operation}d ${affected} product(s)`,
    };
  }

  /**
   * Get abandoned checkouts (carts with checkout sessions in CREATED or LOCKED state but no orders)
   */
  async getAbandonedCheckouts(
    query: AdminQueryAbandonedCheckoutsDto,
  ): Promise<PaginatedAbandonedCheckoutsResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    // Get Redis client to scan for checkout sessions
    const redisClient = await this.redisStoreService.getClient();

    // Scan for all checkout session keys
    const sessionKeys: string[] = [];
    let cursor = "0";

    do {
      const result = await redisClient.scan(
        cursor,
        "MATCH",
        "checkout:session:*",
        "COUNT",
        100,
      );
      cursor = result[0];
      sessionKeys.push(...result[1]);
    } while (cursor !== "0");

    // Get all sessions and filter by CREATED or LOCKED state
    const abandonedSessions: Array<{
      sessionId: string;
      cartId: string;
      paymentIntentId: string | null;
      checkoutState: CheckoutState;
    }> = [];

    for (const key of sessionKeys) {
      try {
        const session = await this.checkoutStore.getSession(
          key.replace("checkout:session:", ""),
        );
        if (
          session &&
          (session.state === CheckoutState.CREATED ||
            session.state === CheckoutState.LOCKED) &&
          !session.orderId // Only include sessions without orders
        ) {
          abandonedSessions.push({
            sessionId: key.replace("checkout:session:", ""),
            cartId: session.cartId,
            paymentIntentId: session.paymentIntentId,
            checkoutState: session.state,
          });
        }
      } catch (_error) {}
    }

    // Get unique cart IDs
    const cartIds = Array.from(new Set(abandonedSessions.map((s) => s.cartId)));

    if (cartIds.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Get carts from database
    const allCarts = await this.db
      .select()
      .from(carts)
      .where(inArray(carts.id, cartIds));

    // Build abandoned checkouts with cart data
    const abandonedCheckouts: AbandonedCheckoutResponse[] = [];

    for (const session of abandonedSessions) {
      const cart = allCarts.find((c) => c.id === session.cartId);
      if (!cart) continue;

      // Get customer email if exists
      let customerEmail: string | null = null;
      if (cart.customerId) {
        const [customer] = await this.db
          .select({ email: customers.email })
          .from(customers)
          .where(eq(customers.id, cart.customerId))
          .limit(1);
        customerEmail = customer?.email || null;
      }

      // Apply filters
      if (query.recoverable !== undefined) {
        const hasPaymentIntent = !!session.paymentIntentId;
        if (query.recoverable !== hasPaymentIntent) continue;
      }

      if (query.hasEmail !== undefined) {
        const hasEmail = !!customerEmail;
        if (query.hasEmail !== hasEmail) continue;
      }

      if (query.minValue !== undefined) {
        if (cart.total < query.minValue) continue;
      }

      // Get enriched cart using CartsService
      const enrichedCart = await this._cartsService.getCartById(
        cart.id,
        cart.customerId,
      );

      abandonedCheckouts.push({
        id: session.sessionId,
        cartId: cart.id,
        customerId: cart.customerId,
        sessionId: cart.sessionId,
        checkoutState: session.checkoutState as "CREATED" | "LOCKED",
        subtotal: enrichedCart.priceSummary.subtotal,
        gstAmount: enrichedCart.priceSummary.gstAmount,
        discountCode: enrichedCart.discountCode,
        discountAmount: enrichedCart.priceSummary.couponDiscount,
        gstBreakdown: enrichedCart.priceSummary.gstBreakdown,
        total: enrichedCart.priceSummary.total,
        items: enrichedCart.items,
        paymentIntentId: session.paymentIntentId,
        customerEmail,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
        expiresAt: cart.expiresAt,
      });
    }

    // Sort by createdAt descending
    abandonedCheckouts.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    // Paginate
    const total = abandonedCheckouts.length;
    const offset = (page - 1) * limit;
    const paginatedData = abandonedCheckouts.slice(offset, offset + limit);
    const totalPages = Math.ceil(total / limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get abandoned checkout by cart ID
   */
  async getAbandonedCheckoutByCartId(
    cartId: string,
  ): Promise<AbandonedCheckoutResponse | null> {
    // Get Redis client to scan for checkout sessions
    const redisClient = await this.redisStoreService.getClient();

    // Scan for checkout session keys
    const sessionKeys: string[] = [];
    let cursor = "0";

    do {
      const result = await redisClient.scan(
        cursor,
        "MATCH",
        "checkout:session:*",
        "COUNT",
        100,
      );
      cursor = result[0];
      sessionKeys.push(...result[1]);
    } while (cursor !== "0");

    // Find session for this cart
    let sessionData: {
      sessionId: string;
      cartId: string;
      paymentIntentId: string | null;
      checkoutState: CheckoutState;
    } | null = null;

    for (const key of sessionKeys) {
      try {
        const session = await this.checkoutStore.getSession(
          key.replace("checkout:session:", ""),
        );
        if (
          session &&
          session.cartId === cartId &&
          (session.state === CheckoutState.CREATED ||
            session.state === CheckoutState.LOCKED) &&
          !session.orderId
        ) {
          sessionData = {
            sessionId: key.replace("checkout:session:", ""),
            cartId: session.cartId,
            paymentIntentId: session.paymentIntentId,
            checkoutState: session.state,
          };
          break;
        }
      } catch (_error) {}
    }

    if (!sessionData) {
      return null;
    }

    // Get cart from database
    const [cart] = await this.db
      .select()
      .from(carts)
      .where(eq(carts.id, cartId))
      .limit(1);

    if (!cart) {
      return null;
    }

    // Get customer email if exists
    let customerEmail: string | null = null;
    if (cart.customerId) {
      const [customer] = await this.db
        .select({ email: customers.email })
        .from(customers)
        .where(eq(customers.id, cart.customerId))
        .limit(1);
      customerEmail = customer?.email || null;
    }

    // Get enriched cart using CartsService
    const enrichedCart = await this._cartsService.getCartById(
      cart.id,
      cart.customerId,
    );

    return {
      id: sessionData.sessionId,
      cartId: cart.id,
      customerId: cart.customerId,
      sessionId: cart.sessionId,
      checkoutState: sessionData.checkoutState as "CREATED" | "LOCKED",
      subtotal: enrichedCart.priceSummary.subtotal,
      gstAmount: enrichedCart.priceSummary.gstAmount,
      discountCode: enrichedCart.discountCode,
      discountAmount: enrichedCart.priceSummary.couponDiscount,
      gstBreakdown: enrichedCart.priceSummary.gstBreakdown,
      total: enrichedCart.priceSummary.total,
      items: enrichedCart.items,
      paymentIntentId: sessionData.paymentIntentId,
      customerEmail,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      expiresAt: cart.expiresAt,
    };
  }

  /**
   * Get abandoned cart statistics
   */
  async getAbandonedCartStats(): Promise<{
    totalAbandoned: number;
    totalRecovered: number;
    recoveryRate: number;
    totalRevenueRecovered: number;
    averageCartValue: number;
    averageRecoveryTime: number;
  }> {
    const { abandonedCartRecoveries, orders, carts } = await import(
      "@vcecom/db"
    );
    const { sql, eq } = await import("drizzle-orm");

    // Get total abandoned carts
    const totalAbandonedResult = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(abandonedCartRecoveries);

    const totalAbandoned = totalAbandonedResult[0]?.count || 0;

    // Get total recovered
    const totalRecoveredResult = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(abandonedCartRecoveries)
      .where(eq(abandonedCartRecoveries.recoveryStatus, "recovered"));

    const totalRecovered = totalRecoveredResult[0]?.count || 0;

    // Calculate recovery rate
    const recoveryRate =
      totalAbandoned > 0 ? (totalRecovered / totalAbandoned) * 100 : 0;

    // Calculate average cart value
    const avgCartValueResult = await this.db
      .select({
        avg: sql<number>`AVG(${carts.total})::real`,
      })
      .from(carts)
      .innerJoin(
        abandonedCartRecoveries,
        eq(abandonedCartRecoveries.cartId, carts.id),
      );

    const averageCartValue = avgCartValueResult[0]?.avg || 0;

    // Calculate total revenue recovered
    const revenueResult = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${orders.total})::real, 0)`,
      })
      .from(abandonedCartRecoveries)
      .innerJoin(
        orders,
        sql`${orders.id}::text = ${abandonedCartRecoveries.metadata}->>'orderId'`,
      )
      .where(eq(abandonedCartRecoveries.recoveryStatus, "recovered"));

    const totalRevenueRecovered = revenueResult[0]?.total || 0;

    // Calculate average recovery time
    const avgRecoveryTimeResult = await this.db
      .select({
        avg: sql<number>`AVG(EXTRACT(EPOCH FROM (${abandonedCartRecoveries.recoveredAt} - ${abandonedCartRecoveries.detectedAt})) / 3600)::real`,
      })
      .from(abandonedCartRecoveries)
      .where(eq(abandonedCartRecoveries.recoveryStatus, "recovered"));

    const averageRecoveryTime = avgRecoveryTimeResult[0]?.avg || 0;

    return {
      totalAbandoned,
      totalRecovered,
      recoveryRate,
      totalRevenueRecovered,
      averageCartValue,
      averageRecoveryTime,
    };
  }

  /**
   * Get abandoned cart analytics
   */
  async getAbandonedCartAnalytics(query: {
    startDate?: string;
    endDate?: string;
    minValue?: number;
    customerId?: string;
  }): Promise<{
    abandonedOverTime: Array<{
      date: string;
      count: number;
      totalValue: number;
    }>;
    recoveryRateOverTime: Array<{ date: string; recoveryRate: number }>;
    recoveryAttemptsBreakdown: {
      emailSent: number;
      smsSent: number;
      recovered: number;
      expired: number;
      failed: number;
    };
    topAbandonedProducts: Array<{
      productId: string;
      productName: string;
      abandonCount: number;
    }>;
  }> {
    const {
      abandonedCartRecoveries,
      carts,
      cartItems,
      productVariants,
      products,
    } = await import("@vcecom/db");
    const { sql, and, gte, lte, eq, desc } = await import("drizzle-orm");
    type SQL = ReturnType<typeof sql>;

    const conditions: SQL[] = [];
    if (query.startDate) {
      conditions.push(
        gte(abandonedCartRecoveries.detectedAt, new Date(query.startDate)),
      );
    }
    if (query.endDate) {
      conditions.push(
        lte(abandonedCartRecoveries.detectedAt, new Date(query.endDate)),
      );
    }
    if (query.customerId) {
      conditions.push(eq(abandonedCartRecoveries.customerId, query.customerId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Abandoned carts over time (daily)
    const abandonedOverTimeResult = await this.db
      .select({
        date: sql<string>`DATE(${abandonedCartRecoveries.detectedAt})::text`,
        count: sql<number>`COUNT(*)::int`,
        totalValue: sql<number>`SUM(${carts.total})::real`,
      })
      .from(abandonedCartRecoveries)
      .innerJoin(carts, eq(abandonedCartRecoveries.cartId, carts.id))
      .where(whereClause)
      .groupBy(sql`DATE(${abandonedCartRecoveries.detectedAt})`)
      .orderBy(sql`DATE(${abandonedCartRecoveries.detectedAt})`);

    // Recovery rate over time
    const recoveryRateOverTimeResult = await this.db
      .select({
        date: sql<string>`DATE(${abandonedCartRecoveries.detectedAt})::text`,
        total: sql<number>`COUNT(*)::int`,
        recovered: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCartRecoveries.recoveryStatus} = 'recovered')::int`,
      })
      .from(abandonedCartRecoveries)
      .where(whereClause)
      .groupBy(sql`DATE(${abandonedCartRecoveries.detectedAt})`)
      .orderBy(sql`DATE(${abandonedCartRecoveries.detectedAt})`);

    const recoveryRateOverTime = recoveryRateOverTimeResult.map((row) => ({
      date: row.date,
      recoveryRate: row.total > 0 ? (row.recovered / row.total) * 100 : 0,
    }));

    // Recovery attempts breakdown
    const breakdownResult = await this.db
      .select({
        status: abandonedCartRecoveries.recoveryStatus,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(abandonedCartRecoveries)
      .where(whereClause)
      .groupBy(abandonedCartRecoveries.recoveryStatus);

    const breakdown = breakdownResult.reduce(
      (acc, row) => {
        acc[row.status as keyof typeof acc] = row.count;
        return acc;
      },
      {
        email_sent: 0,
        sms_sent: 0,
        recovered: 0,
        expired: 0,
        failed: 0,
      },
    );

    // Top abandoned products
    const topProductsResult = await this.db
      .select({
        productId: products.id,
        productName: products.title,
        abandonCount: sql<number>`COUNT(DISTINCT ${abandonedCartRecoveries.cartId})::int`,
      })
      .from(abandonedCartRecoveries)
      .innerJoin(carts, eq(abandonedCartRecoveries.cartId, carts.id))
      .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
      .innerJoin(
        productVariants,
        eq(cartItems.productVariantId, productVariants.id),
      )
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(whereClause)
      .groupBy(products.id, products.title)
      .orderBy(desc(sql`COUNT(DISTINCT ${abandonedCartRecoveries.cartId})`))
      .limit(10);

    return {
      abandonedOverTime: abandonedOverTimeResult.map((row) => ({
        date: row.date,
        count: row.count,
        totalValue: row.totalValue || 0,
      })),
      recoveryRateOverTime,
      recoveryAttemptsBreakdown: {
        emailSent: breakdown.email_sent,
        smsSent: breakdown.sms_sent,
        recovered: breakdown.recovered,
        expired: breakdown.expired,
        failed: breakdown.failed,
      },
      topAbandonedProducts: topProductsResult.map((row) => ({
        productId: row.productId,
        productName: row.productName,
        abandonCount: row.abandonCount,
      })),
    };
  }

  /**
   * Get recovery campaign statistics
   */
  async getRecoveryCampaignStats(): Promise<
    Array<{
      campaignId: string;
      totalCarts: number;
      emailsSent: number;
      smsSent: number;
      recovered: number;
      recoveryRate: number;
      totalRevenueRecovered: number;
    }>
  > {
    const { abandonedCartRecoveries, orders } = await import("@vcecom/db");
    const { sql, eq, desc, and } = await import("drizzle-orm");

    // Group by detected date (daily campaigns)
    const campaignsResult = await this.db
      .select({
        campaignId: sql<string>`DATE(${abandonedCartRecoveries.detectedAt})::text`,
        totalCarts: sql<number>`COUNT(*)::int`,
        emailsSent: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCartRecoveries.emailSentAt} IS NOT NULL)::int`,
        smsSent: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCartRecoveries.smsSentAt} IS NOT NULL)::int`,
        recovered: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCartRecoveries.recoveryStatus} = 'recovered')::int`,
      })
      .from(abandonedCartRecoveries)
      .groupBy(sql`DATE(${abandonedCartRecoveries.detectedAt})`)
      .orderBy(desc(sql`DATE(${abandonedCartRecoveries.detectedAt})`))
      .limit(30); // Last 30 days

    // Calculate revenue for each campaign
    const campaigns = await Promise.all(
      campaignsResult.map(async (campaign) => {
        const revenueResult = await this.db
          .select({
            total: sql<number>`COALESCE(SUM(${orders.total})::real, 0)`,
          })
          .from(abandonedCartRecoveries)
          .innerJoin(
            orders,
            sql`${orders.id}::text = ${abandonedCartRecoveries.metadata}->>'orderId'`,
          )
          .where(
            and(
              eq(abandonedCartRecoveries.recoveryStatus, "recovered"),
              sql`DATE(${abandonedCartRecoveries.detectedAt}) = ${campaign.campaignId}::date`,
            ),
          );

        const totalRevenueRecovered = revenueResult[0]?.total || 0;
        const recoveryRate =
          campaign.totalCarts > 0
            ? (campaign.recovered / campaign.totalCarts) * 100
            : 0;

        return {
          campaignId: campaign.campaignId,
          totalCarts: campaign.totalCarts,
          emailsSent: campaign.emailsSent,
          smsSent: campaign.smsSent,
          recovered: campaign.recovered,
          recoveryRate,
          totalRevenueRecovered,
        };
      }),
    );

    return campaigns;
  }
}
