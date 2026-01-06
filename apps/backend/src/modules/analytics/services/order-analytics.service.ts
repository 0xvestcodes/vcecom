import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lte, orders, shipments, sql } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { DateRange } from "../dto/common.dto";
import {
  OrderAnalyticsResponseDto,
  OrderFulfillmentMetricsDto,
  OrderMetricsDto,
  OrderStatusBreakdownDto,
  OrderTrendDataPointDto,
} from "../dto/order-analytics.dto";
import { CachedMetricsService } from "./cached-metrics.service";

@Injectable()
export class OrderAnalyticsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly cachedMetrics: CachedMetricsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get order metrics for a period
   */
  async getOrderMetrics(period: DateRange): Promise<OrderMetricsDto> {
    return this.cachedMetrics.getCachedOrderMetrics(period, async () => {
      try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now);
        monthStart.setDate(monthStart.getDate() - 30);
        monthStart.setHours(0, 0, 0, 0);

        // Get total orders and revenue for period
        const periodMetrics = await this.db
          .select({
            totalOrders: sql<number>`COUNT(*)::int`,
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

        const { totalOrders, totalRevenue } = periodMetrics[0] || {
          totalOrders: 0,
          totalRevenue: 0,
        };

        const averageOrderValue =
          totalOrders > 0 ? Number(totalRevenue) / totalOrders : 0;

        // Get orders today
        const todayMetrics = await this.db
          .select({
            count: sql<number>`COUNT(*)::int`,
          })
          .from(orders)
          .where(
            and(gte(orders.createdAt, todayStart), eq(orders.archived, false)),
          );

        // Get orders this week
        const weekMetrics = await this.db
          .select({
            count: sql<number>`COUNT(*)::int`,
          })
          .from(orders)
          .where(
            and(gte(orders.createdAt, weekStart), eq(orders.archived, false)),
          );

        // Get orders this month
        const monthMetrics = await this.db
          .select({
            count: sql<number>`COUNT(*)::int`,
          })
          .from(orders)
          .where(
            and(gte(orders.createdAt, monthStart), eq(orders.archived, false)),
          );

        return {
          totalOrders: Number(totalOrders),
          totalRevenue: Number(totalRevenue),
          averageOrderValue,
          ordersToday: Number(todayMetrics[0]?.count || 0),
          ordersThisWeek: Number(weekMetrics[0]?.count || 0),
          ordersThisMonth: Number(monthMetrics[0]?.count || 0),
        };
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "OrderAnalyticsService.getOrderMetrics",
            error,
            { period },
          ),
          "Failed to get order metrics",
        );
        throw error;
      }
    });
  }

  /**
   * Get order status breakdown
   */
  async getOrderStatusBreakdown(
    period?: DateRange,
  ): Promise<OrderStatusBreakdownDto[]> {
    const cacheKey = period
      ? this.cachedMetrics.getCachedOrderStatusBreakdown.bind(
          this.cachedMetrics,
        )
      : null;

    const computeFn = async () => {
      try {
        const conditions = [eq(orders.archived, false)];
        if (period) {
          conditions.push(
            gte(orders.createdAt, period.startDate),
            lte(orders.createdAt, period.endDate),
          );
        }

        const breakdown = await this.db
          .select({
            status: orders.status,
            count: sql<number>`COUNT(*)::int`,
            revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
          })
          .from(orders)
          .where(and(...conditions))
          .groupBy(orders.status);

        return breakdown.map((item) => ({
          status: item.status,
          count: Number(item.count),
          revenue: Number(item.revenue),
        }));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "OrderAnalyticsService.getOrderStatusBreakdown",
            error,
            { period },
          ),
          "Failed to get order status breakdown",
        );
        throw error;
      }
    };

    if (cacheKey && period) {
      return cacheKey(period, computeFn);
    }

    return computeFn();
  }

  /**
   * Get order trends over time
   */
  async getOrderTrends(
    period: DateRange,
    granularity: "day" | "week" | "month" = "day",
  ): Promise<OrderTrendDataPointDto[]> {
    return this.cachedMetrics.getCachedOrderTrends(
      period,
      granularity,
      async () => {
        try {
          let dateTrunc: string;
          switch (granularity) {
            case "day":
              dateTrunc = "day";
              break;
            case "week":
              dateTrunc = "week";
              break;
            case "month":
              dateTrunc = "month";
              break;
            default:
              dateTrunc = "day";
          }

          const trends = await this.db
            .select({
              date: sql<string>`DATE_TRUNC('${sql.raw(dateTrunc)}', ${orders.createdAt})::text`,
              orders: sql<number>`COUNT(*)::int`,
              revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
            })
            .from(orders)
            .where(
              and(
                gte(orders.createdAt, period.startDate),
                lte(orders.createdAt, period.endDate),
                eq(orders.archived, false),
              ),
            )
            .groupBy(
              sql`DATE_TRUNC('${sql.raw(dateTrunc)}', ${orders.createdAt})`,
            )
            .orderBy(
              sql`DATE_TRUNC('${sql.raw(dateTrunc)}', ${orders.createdAt})`,
            );

          return trends.map((item) => ({
            date: item.date.split("T")[0],
            orders: Number(item.orders),
            revenue: Number(item.revenue),
          }));
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "OrderAnalyticsService.getOrderTrends",
              error,
              { period, granularity },
            ),
            "Failed to get order trends",
          );
          throw error;
        }
      },
    );
  }

  /**
   * Get average order value
   */
  async getAverageOrderValue(period: DateRange): Promise<number> {
    try {
      const result = await this.db
        .select({
          avg: sql<number>`COALESCE(AVG(${orders.total}), 0)`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, period.startDate),
            lte(orders.createdAt, period.endDate),
            eq(orders.archived, false),
          ),
        );

      return Number(result[0]?.avg || 0);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrderAnalyticsService.getAverageOrderValue",
          error,
          { period },
        ),
        "Failed to get average order value",
      );
      throw error;
    }
  }

  /**
   * Get order fulfillment metrics
   */
  async getOrderFulfillmentMetrics(
    period: DateRange,
  ): Promise<OrderFulfillmentMetricsDto> {
    try {
      // Get delivered orders with shipment data
      const fulfillmentData = await this.db
        .select({
          orderCreatedAt: orders.createdAt,
          shipmentDeliveredAt: shipments.updatedAt,
        })
        .from(orders)
        .leftJoin(shipments, eq(shipments.orderId, orders.id))
        .where(
          and(
            gte(orders.createdAt, period.startDate),
            lte(orders.createdAt, period.endDate),
            eq(orders.status, "delivered"),
            eq(orders.archived, false),
            eq(shipments.status, "delivered"),
          ),
        );

      if (fulfillmentData.length === 0) {
        return {
          averageFulfillmentTime: 0,
          onTimeFulfillments: 0,
          delayedFulfillments: 0,
          onTimeRate: 0,
        };
      }

      // Calculate fulfillment times (in hours)
      const fulfillmentTimes = fulfillmentData
        .filter((item) => item.shipmentDeliveredAt)
        .map((item) => {
          const created = new Date(item.orderCreatedAt);
          if (!item.shipmentDeliveredAt) {
            throw new Error("shipmentDeliveredAt is required");
          }
          const delivered = new Date(item.shipmentDeliveredAt);
          return (delivered.getTime() - created.getTime()) / (1000 * 60 * 60);
        });

      const averageFulfillmentTime =
        fulfillmentTimes.length > 0
          ? fulfillmentTimes.reduce((sum, time) => sum + time, 0) /
            fulfillmentTimes.length
          : 0;

      // Assume 48 hours SLA for on-time fulfillment
      const SLA_HOURS = 48;
      const onTimeFulfillments = fulfillmentTimes.filter(
        (time) => time <= SLA_HOURS,
      ).length;
      const delayedFulfillments = fulfillmentTimes.length - onTimeFulfillments;
      const onTimeRate =
        fulfillmentTimes.length > 0
          ? (onTimeFulfillments / fulfillmentTimes.length) * 100
          : 0;

      return {
        averageFulfillmentTime: Math.round(averageFulfillmentTime * 10) / 10,
        onTimeFulfillments,
        delayedFulfillments,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrderAnalyticsService.getOrderFulfillmentMetrics",
          error,
          { period },
        ),
        "Failed to get order fulfillment metrics",
      );
      throw error;
    }
  }

  /**
   * Get complete order analytics
   */
  async getOrderAnalytics(
    period: DateRange,
    includeFulfillment = false,
  ): Promise<OrderAnalyticsResponseDto> {
    const [metrics, statusBreakdown, trends, fulfillmentMetrics] =
      await Promise.all([
        this.getOrderMetrics(period),
        this.getOrderStatusBreakdown(period),
        this.getOrderTrends(period, "day"),
        includeFulfillment
          ? this.getOrderFulfillmentMetrics(period)
          : Promise.resolve(undefined),
      ]);

    return {
      metrics,
      statusBreakdown,
      trends,
      fulfillmentMetrics,
    };
  }
}
