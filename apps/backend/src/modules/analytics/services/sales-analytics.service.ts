import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  categories,
  eq,
  gte,
  lte,
  orderItems,
  orders,
  products,
  productVariants,
  refunds,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { DateRange } from "../dto/common.dto";
import {
  PeriodComparisonDto,
  ProfitMetricsDto,
  RefundMetricsDto,
  RevenueByCategoryDto,
  RevenueByPaymentMethodDto,
  RevenueMetricsDto,
  SalesAnalyticsResponseDto,
} from "../dto/sales-analytics.dto";
import { CachedMetricsService } from "./cached-metrics.service";

@Injectable()
export class SalesAnalyticsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly cachedMetrics: CachedMetricsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get revenue metrics for a period
   */
  async getRevenueMetrics(period: DateRange): Promise<RevenueMetricsDto> {
    return this.cachedMetrics.getCachedSalesRevenue(period, async () => {
      try {
        // Get current period metrics
        const currentMetrics = await this.db
          .select({
            totalRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
            orderCount: sql<number>`COUNT(*)::int`,
          })
          .from(orders)
          .where(
            and(
              gte(orders.createdAt, period.startDate),
              lte(orders.createdAt, period.endDate),
              eq(orders.archived, false),
            ),
          );

        const { totalRevenue, orderCount } = currentMetrics[0] || {
          totalRevenue: 0,
          orderCount: 0,
        };

        const averageOrderValue =
          orderCount > 0 ? Number(totalRevenue) / Number(orderCount) : 0;

        // Calculate previous period for growth comparison
        const periodDays =
          (period.endDate.getTime() - period.startDate.getTime()) /
          (1000 * 60 * 60 * 24);
        const previousStartDate = new Date(period.startDate);
        previousStartDate.setDate(previousStartDate.getDate() - periodDays);
        const previousEndDate = new Date(period.startDate);

        const previousMetrics = await this.db
          .select({
            totalRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
          })
          .from(orders)
          .where(
            and(
              gte(orders.createdAt, previousStartDate),
              lte(orders.createdAt, previousEndDate),
              eq(orders.archived, false),
            ),
          );

        const previousRevenue = Number(previousMetrics[0]?.totalRevenue || 0);
        const growthPercentage =
          previousRevenue > 0
            ? ((Number(totalRevenue) - previousRevenue) / previousRevenue) * 100
            : 0;

        return {
          totalRevenue: Number(totalRevenue),
          averageOrderValue,
          growthPercentage: Math.round(growthPercentage * 10) / 10,
        };
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "SalesAnalyticsService.getRevenueMetrics",
            error,
            { period },
          ),
          "Failed to get revenue metrics",
        );
        throw error;
      }
    });
  }

  /**
   * Compare revenue across multiple periods
   */
  async getRevenueByPeriod(
    periods: DateRange[],
  ): Promise<PeriodComparisonDto[]> {
    try {
      const periodMetrics = await Promise.all(
        periods.map(async (period, index) => {
          const metrics = await this.db
            .select({
              revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
              orders: sql<number>`COUNT(*)::int`,
            })
            .from(orders)
            .where(
              and(
                gte(orders.createdAt, period.startDate),
                lte(orders.createdAt, period.endDate),
                eq(orders.archived, false),
              ),
            );

          const { revenue, orders: orderCount } = metrics[0] || {
            revenue: 0,
            orders: 0,
          };

          // Calculate change from previous period
          let changePercentage = 0;
          if (index > 0) {
            const previousMetrics = await this.db
              .select({
                revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
              })
              .from(orders)
              .where(
                and(
                  gte(orders.createdAt, periods[index - 1].startDate),
                  lte(orders.createdAt, periods[index - 1].endDate),
                  eq(orders.archived, false),
                ),
              );

            const previousRevenue = Number(previousMetrics[0]?.revenue || 0);
            if (previousRevenue > 0) {
              changePercentage =
                ((Number(revenue) - previousRevenue) / previousRevenue) * 100;
            }
          }

          const periodName = `${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}`;

          return {
            period: periodName,
            revenue: Number(revenue),
            orders: Number(orderCount),
            changePercentage: Math.round(changePercentage * 10) / 10,
          };
        }),
      );

      return periodMetrics;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SalesAnalyticsService.getRevenueByPeriod",
          error,
          { periods },
        ),
        "Failed to get revenue by period",
      );
      throw error;
    }
  }

  /**
   * Get revenue breakdown by category
   */
  async getRevenueByCategory(
    period: DateRange,
  ): Promise<RevenueByCategoryDto[]> {
    return this.cachedMetrics.getCachedSalesByCategory(period, async () => {
      try {
        const categoryRevenue = await this.db
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
            sql`COALESCE(SUM(${orderItems.price} * ${orderItems.quantity}), 0) DESC`,
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

        return categoryRevenue
          .map((item) => ({
            categoryId: item.categoryId || "uncategorized",
            categoryName: item.categoryName || "Uncategorized",
            revenue: Number(item.revenue),
            unitsSold: Number(item.unitsSold),
            percentage:
              totalRevenue > 0
                ? (Number(item.revenue) / totalRevenue) * 100
                : 0,
          }))
          .map((item) => ({
            ...item,
            productCount: productCountMap.get(item.categoryId) || 0,
          }));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "SalesAnalyticsService.getRevenueByCategory",
            error,
            { period },
          ),
          "Failed to get revenue by category",
        );
        throw error;
      }
    });
  }

  /**
   * Get revenue breakdown by payment method
   */
  async getRevenueByPaymentMethod(
    period: DateRange,
  ): Promise<RevenueByPaymentMethodDto[]> {
    return this.cachedMetrics.getCachedSalesByPaymentMethod(
      period,
      async () => {
        try {
          const paymentMethodRevenue = await this.db
            .select({
              paymentMethod: orders.paymentMethod,
              revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
              orderCount: sql<number>`COUNT(*)::int`,
            })
            .from(orders)
            .where(
              and(
                gte(orders.createdAt, period.startDate),
                lte(orders.createdAt, period.endDate),
                eq(orders.archived, false),
              ),
            )
            .groupBy(orders.paymentMethod)
            .orderBy(sql`COALESCE(SUM(${orders.total}), 0) DESC`);

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

          return paymentMethodRevenue.map((item) => ({
            paymentMethod: item.paymentMethod || "unknown",
            revenue: Number(item.revenue),
            orderCount: Number(item.orderCount),
            percentage:
              totalRevenue > 0
                ? (Number(item.revenue) / totalRevenue) * 100
                : 0,
          }));
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "SalesAnalyticsService.getRevenueByPaymentMethod",
              error,
              { period },
            ),
            "Failed to get revenue by payment method",
          );
          throw error;
        }
      },
    );
  }

  /**
   * Get refund metrics
   */
  async getRefundMetrics(period: DateRange): Promise<RefundMetricsDto> {
    try {
      // Get refund data
      const refundData = await this.db
        .select({
          totalRefunds: sql<number>`COUNT(*)::int`,
          totalRefundAmount: sql<number>`COALESCE(SUM(${refunds.amount}), 0)`,
        })
        .from(refunds)
        .innerJoin(orders, eq(orders.id, refunds.orderId))
        .where(
          and(
            gte(refunds.createdAt, period.startDate),
            lte(refunds.createdAt, period.endDate),
            eq(orders.archived, false),
          ),
        );

      // Get total orders for refund rate calculation
      const totalOrdersResult = await this.db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, period.startDate),
            lte(orders.createdAt, period.endDate),
            eq(orders.archived, false),
          ),
        );

      const totalOrders = Number(totalOrdersResult[0]?.count || 0);
      const totalRefunds = Number(refundData[0]?.totalRefunds || 0);
      const totalRefundAmount = Number(refundData[0]?.totalRefundAmount || 0);
      const refundRate =
        totalOrders > 0 ? (totalRefunds / totalOrders) * 100 : 0;
      const averageRefundAmount =
        totalRefunds > 0 ? totalRefundAmount / totalRefunds : 0;

      return {
        totalRefunds,
        totalRefundAmount,
        refundRate: Math.round(refundRate * 10) / 10,
        averageRefundAmount: Math.round(averageRefundAmount * 10) / 10,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SalesAnalyticsService.getRefundMetrics",
          error,
          { period },
        ),
        "Failed to get refund metrics",
      );
      throw error;
    }
  }

  /**
   * Get profit metrics (simplified - assumes 70% cost margin)
   */
  async getProfitMetrics(period: DateRange): Promise<ProfitMetricsDto> {
    try {
      const revenueResult = await this.db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, period.startDate),
            lte(orders.createdAt, period.endDate),
            eq(orders.archived, false),
          ),
        );

      const totalRevenue = Number(revenueResult[0]?.totalRevenue || 0);
      // Simplified: assume 70% of revenue is cost (30% margin)
      const estimatedCost = totalRevenue * 0.7;
      const totalProfit = totalRevenue - estimatedCost;
      const grossMargin =
        totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      // Assume 10% overhead for net margin
      const netMargin = grossMargin * 0.9;

      return {
        totalProfit: Math.round(totalProfit * 100) / 100,
        grossMargin: Math.round(grossMargin * 10) / 10,
        netMargin: Math.round(netMargin * 10) / 10,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SalesAnalyticsService.getProfitMetrics",
          error,
          { period },
        ),
        "Failed to get profit metrics",
      );
      throw error;
    }
  }

  /**
   * Get complete sales analytics
   */
  async getSalesAnalytics(
    period: DateRange,
    includeProfit = false,
  ): Promise<SalesAnalyticsResponseDto> {
    const [
      revenue,
      revenueByCategory,
      revenueByPaymentMethod,
      refunds,
      profit,
    ] = await Promise.all([
      this.getRevenueMetrics(period),
      this.getRevenueByCategory(period),
      this.getRevenueByPaymentMethod(period),
      this.getRefundMetrics(period),
      includeProfit
        ? this.getProfitMetrics(period)
        : Promise.resolve(undefined),
    ]);

    // Generate period comparisons (current vs previous month)
    const currentMonth = period;
    const previousMonthStart = new Date(period.startDate);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    const previousMonthEnd = new Date(period.startDate);
    previousMonthEnd.setDate(previousMonthEnd.getDate() - 1);

    const periodComparisons = await this.getRevenueByPeriod([
      {
        startDate: previousMonthStart,
        endDate: previousMonthEnd,
      },
      currentMonth,
    ]);

    return {
      revenue,
      periodComparisons,
      revenueByCategory,
      revenueByPaymentMethod,
      refunds,
      profit,
    };
  }
}
