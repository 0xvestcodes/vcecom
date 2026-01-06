import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  categories,
  desc,
  eq,
  gte,
  inArray,
  lte,
  orderItems,
  orders,
  products,
  productVariants,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { DateRange } from "../dto/common.dto";
import {
  CategoryPerformanceDto,
  InventoryTurnoverDto,
  ProductPerformanceDto,
  ProductPerformanceResponseDto,
  VariantPerformanceDto,
} from "../dto/product-performance.dto";
import { CachedMetricsService } from "./cached-metrics.service";

@Injectable()
export class ProductPerformanceService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly cachedMetrics: CachedMetricsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get top selling products
   */
  async getTopSellingProducts(
    limit: number,
    period: DateRange,
  ): Promise<ProductPerformanceDto[]> {
    return this.cachedMetrics.getCachedTopProducts(limit, period, async () => {
      try {
        const topProducts = await this.db
          .select({
            productId: products.id,
            productTitle: products.title,
            revenue: sql<number>`COALESCE(SUM(${orderItems.price} * ${orderItems.quantity}), 0)`,
            unitsSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .innerJoin(
            productVariants,
            eq(productVariants.id, orderItems.productVariantId),
          )
          .innerJoin(products, eq(products.id, productVariants.productId))
          .where(
            and(
              gte(orders.createdAt, period.startDate),
              lte(orders.createdAt, period.endDate),
              eq(orders.archived, false),
            ),
          )
          .groupBy(products.id, products.title)
          .orderBy(
            desc(
              sql`COALESCE(SUM(${orderItems.price} * ${orderItems.quantity}), 0)`,
            ),
          )
          .limit(limit);

        // Get current inventory and calculate margins
        const productIds = topProducts.map((p) => p.productId);
        const productDetails =
          productIds.length > 0
            ? await this.db
                .select({
                  id: products.id,
                  price: products.price,
                })
                .from(products)
                .where(inArray(products.id, productIds))
            : [];

        const productPriceMap = new Map(
          productDetails.map((p) => [p.id, Number(p.price)]),
        );

        return topProducts.map((item) => {
          const revenue = Number(item.revenue);
          const unitsSold = Number(item.unitsSold);
          const averagePrice = unitsSold > 0 ? revenue / unitsSold : 0;
          const _basePrice = productPriceMap.get(item.productId) || 0;
          // Simplified: assume 30% margin
          const grossMargin = revenue * 0.3;
          const grossMarginPercentage =
            revenue > 0 ? (grossMargin / revenue) * 100 : 0;

          return {
            productId: item.productId,
            productTitle: item.productTitle,
            revenue: Math.round(revenue * 100) / 100,
            unitsSold,
            averagePrice: Math.round(averagePrice * 100) / 100,
            grossMargin: Math.round(grossMargin * 100) / 100,
            grossMarginPercentage: Math.round(grossMarginPercentage * 10) / 10,
          };
        });
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "ProductPerformanceService.getTopSellingProducts",
            error,
            { limit, period },
          ),
          "Failed to get top selling products",
        );
        throw error;
      }
    });
  }

  /**
   * Get worst selling products
   */
  async getWorstSellingProducts(
    limit: number,
    period: DateRange,
  ): Promise<ProductPerformanceDto[]> {
    try {
      const worstProducts = await this.db
        .select({
          productId: products.id,
          productTitle: products.title,
          revenue: sql<number>`COALESCE(SUM(${orderItems.price} * ${orderItems.quantity}), 0)`,
          unitsSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(
          productVariants,
          eq(productVariants.id, orderItems.productVariantId),
        )
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            gte(orders.createdAt, period.startDate),
            lte(orders.createdAt, period.endDate),
            eq(orders.archived, false),
          ),
        )
        .groupBy(products.id, products.title)
        .orderBy(
          asc(
            sql`COALESCE(SUM(${orderItems.price} * ${orderItems.quantity}), 0)`,
          ),
        )
        .limit(limit);

      const productIds = worstProducts.map((p) => p.productId);
      const productDetails = await this.db
        .select({
          id: products.id,
          price: products.price,
        })
        .from(products)
        .where(
          sql`${products.id} = ANY(${sql.raw(`ARRAY[${productIds.map((id) => `'${id}'`).join(",")}]`)}::uuid[])`,
        );

      const _productPriceMap = new Map(
        productDetails.map((p) => [p.id, Number(p.price)]),
      );

      return worstProducts.map((item) => {
        const revenue = Number(item.revenue);
        const unitsSold = Number(item.unitsSold);
        const averagePrice = unitsSold > 0 ? revenue / unitsSold : 0;
        const grossMargin = revenue * 0.3;
        const grossMarginPercentage =
          revenue > 0 ? (grossMargin / revenue) * 100 : 0;

        return {
          productId: item.productId,
          productTitle: item.productTitle,
          revenue: Math.round(revenue * 100) / 100,
          unitsSold,
          averagePrice: Math.round(averagePrice * 100) / 100,
          grossMargin: Math.round(grossMargin * 100) / 100,
          grossMarginPercentage: Math.round(grossMarginPercentage * 10) / 10,
        };
      });
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ProductPerformanceService.getWorstSellingProducts",
          error,
          { limit, period },
        ),
        "Failed to get worst selling products",
      );
      throw error;
    }
  }

  /**
   * Get product sales trends
   */
  async getProductSalesTrends(
    productId: string,
    period: DateRange,
  ): Promise<Array<{ date: string; unitsSold: number; revenue: number }>> {
    try {
      const trends = await this.db
        .select({
          date: sql<string>`DATE_TRUNC('day', ${orders.createdAt})::text`,
          unitsSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
          revenue: sql<number>`COALESCE(SUM(${orderItems.price} * ${orderItems.quantity}), 0)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(
          productVariants,
          eq(productVariants.id, orderItems.productVariantId),
        )
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            eq(products.id, productId),
            gte(orders.createdAt, period.startDate),
            lte(orders.createdAt, period.endDate),
            eq(orders.archived, false),
          ),
        )
        .groupBy(sql`DATE_TRUNC('day', ${orders.createdAt})`)
        .orderBy(sql`DATE_TRUNC('day', ${orders.createdAt})`);

      return trends.map((item) => ({
        date: item.date.split("T")[0],
        unitsSold: Number(item.unitsSold),
        revenue: Number(item.revenue),
      }));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ProductPerformanceService.getProductSalesTrends",
          error,
          { productId, period },
        ),
        "Failed to get product sales trends",
      );
      throw error;
    }
  }

  /**
   * Get category performance
   */
  async getCategoryPerformance(
    period: DateRange,
  ): Promise<CategoryPerformanceDto[]> {
    return this.cachedMetrics.getCachedCategoryPerformance(period, async () => {
      try {
        const categoryPerformance = await this.db
          .select({
            categoryId: categories.id,
            categoryName: categories.name,
            revenue: sql<number>`COALESCE(SUM(${orderItems.price} * ${orderItems.quantity}), 0)`,
            unitsSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .innerJoin(
            productVariants,
            eq(productVariants.id, orderItems.productVariantId),
          )
          .innerJoin(products, eq(products.id, productVariants.productId))
          .leftJoin(categories, eq(categories.id, products.categoryId))
          .where(
            and(
              gte(orders.createdAt, period.startDate),
              lte(orders.createdAt, period.endDate),
              eq(orders.archived, false),
            ),
          )
          .groupBy(categories.id, categories.name)
          .orderBy(
            desc(
              sql`COALESCE(SUM(${orderItems.price} * ${orderItems.quantity}), 0)`,
            ),
          );

        // Get total revenue for percentage calculation
        const totalRevenueResult = await this.db
          .select({
            total: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
          })
          .from(orders)
          .where(
            and(
              gte(orders.createdAt, period.startDate),
              lte(orders.createdAt, period.endDate),
              eq(orders.archived, false),
            ),
          );

        const totalRevenue = Number(totalRevenueResult[0]?.total || 0);

        // Get product count per category
        const categoryProductCounts = await this.db
          .select({
            categoryId: categories.id,
            productCount: sql<number>`COUNT(DISTINCT ${products.id})::int`,
          })
          .from(products)
          .leftJoin(categories, eq(categories.id, products.categoryId))
          .groupBy(categories.id);

        const productCountMap = new Map(
          categoryProductCounts.map((item) => [
            item.categoryId || "uncategorized",
            Number(item.productCount),
          ]),
        );

        return categoryPerformance.map((item) => ({
          categoryId: item.categoryId || "uncategorized",
          categoryName: item.categoryName || "Uncategorized",
          revenue: Number(item.revenue),
          unitsSold: Number(item.unitsSold),
          productCount:
            productCountMap.get(item.categoryId || "uncategorized") || 0,
          percentage:
            totalRevenue > 0 ? (Number(item.revenue) / totalRevenue) * 100 : 0,
        }));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "ProductPerformanceService.getCategoryPerformance",
            error,
            { period },
          ),
          "Failed to get category performance",
        );
        throw error;
      }
    });
  }

  /**
   * Get top performing variants
   */
  async getVariantPerformance(
    period: DateRange,
    limit = 20,
  ): Promise<VariantPerformanceDto[]> {
    return this.cachedMetrics.getCachedVariantPerformance(period, async () => {
      try {
        const variantPerformance = await this.db
          .select({
            variantId: productVariants.id,
            productId: products.id,
            productTitle: products.title,
            size: productVariants.size,
            color: productVariants.color,
            unitsSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
            revenue: sql<number>`COALESCE(SUM(${orderItems.price} * ${orderItems.quantity}), 0)`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .innerJoin(
            productVariants,
            eq(productVariants.id, orderItems.productVariantId),
          )
          .innerJoin(products, eq(products.id, productVariants.productId))
          .where(
            and(
              gte(orders.createdAt, period.startDate),
              lte(orders.createdAt, period.endDate),
              eq(orders.archived, false),
            ),
          )
          .groupBy(
            productVariants.id,
            products.id,
            products.title,
            productVariants.size,
            productVariants.color,
          )
          .orderBy(
            desc(
              sql`COALESCE(SUM(${orderItems.price} * ${orderItems.quantity}), 0)`,
            ),
          )
          .limit(limit);

        return variantPerformance.map((item) => ({
          variantId: item.variantId,
          productId: item.productId,
          productTitle: item.productTitle,
          attributes: {
            ...(item.size && { size: item.size }),
            ...(item.color && { color: item.color }),
          },
          unitsSold: Number(item.unitsSold),
          revenue: Number(item.revenue),
        }));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "ProductPerformanceService.getVariantPerformance",
            error,
            { period, limit },
          ),
          "Failed to get variant performance",
        );
        throw error;
      }
    });
  }

  /**
   * Get inventory turnover analysis
   */
  async getInventoryTurnover(
    period: DateRange,
  ): Promise<InventoryTurnoverDto[]> {
    return this.cachedMetrics.getCachedInventoryTurnover(period, async () => {
      try {
        // Get products with sales and inventory
        const productSales = await this.db
          .select({
            productId: products.id,
            productTitle: products.title,
            unitsSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
            currentInventory: sql<number>`COALESCE(SUM(${productVariants.inventory}), 0)::int`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .innerJoin(
            productVariants,
            eq(productVariants.id, orderItems.productVariantId),
          )
          .innerJoin(products, eq(products.id, productVariants.productId))
          .where(
            and(
              gte(orders.createdAt, period.startDate),
              lte(orders.createdAt, period.endDate),
              eq(orders.archived, false),
            ),
          )
          .groupBy(products.id, products.title)
          .having(sql`COALESCE(SUM(${orderItems.quantity}), 0) > 0`);

        // Calculate turnover rate and days to sell
        const periodDays =
          (period.endDate.getTime() - period.startDate.getTime()) /
          (1000 * 60 * 60 * 24);

        return productSales.map((item) => {
          const unitsSold = Number(item.unitsSold);
          const currentInventory = Number(item.currentInventory);
          const averageDailySales = unitsSold / periodDays;
          const turnoverRate =
            currentInventory > 0
              ? unitsSold / (currentInventory + unitsSold)
              : 0;
          const daysToSell =
            averageDailySales > 0 ? currentInventory / averageDailySales : 0;

          return {
            productId: item.productId,
            productTitle: item.productTitle,
            turnoverRate: Math.round(turnoverRate * 100) / 100,
            daysToSell: Math.round(daysToSell),
            currentInventory,
            unitsSold,
          };
        });
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "ProductPerformanceService.getInventoryTurnover",
            error,
            { period },
          ),
          "Failed to get inventory turnover",
        );
        throw error;
      }
    });
  }

  /**
   * Get complete product performance analytics
   */
  async getProductPerformance(
    period: DateRange,
    topLimit = 10,
    worstLimit = 10,
  ): Promise<ProductPerformanceResponseDto> {
    const [
      bestSellingProducts,
      worstSellingProducts,
      categoryPerformance,
      topVariants,
      inventoryTurnover,
    ] = await Promise.all([
      this.getTopSellingProducts(topLimit, period),
      this.getWorstSellingProducts(worstLimit, period),
      this.getCategoryPerformance(period),
      this.getVariantPerformance(period, 20),
      this.getInventoryTurnover(period),
    ]);

    return {
      bestSellingProducts,
      worstSellingProducts,
      categoryPerformance,
      topVariants,
      inventoryTurnover,
    };
  }
}
