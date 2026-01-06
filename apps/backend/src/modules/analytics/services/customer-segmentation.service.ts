import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  customers,
  desc,
  eq,
  gte,
  inArray,
  lte,
  orders,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { DateRange } from "../dto/common.dto";
import {
  CustomerAcquisitionMetricsDto,
  CustomerLifetimeValueDto,
  CustomerRetentionMetricsDto,
  CustomerSegmentationDto,
  CustomerSegmentationResponseDto,
  RFMAnalysisDto,
  RFMSegmentDto,
} from "../dto/customer-segmentation.dto";
import { CachedMetricsService } from "./cached-metrics.service";

@Injectable()
export class CustomerSegmentationService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly cachedMetrics: CachedMetricsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get customer segmentation (new vs returning)
   */
  async getCustomerSegmentation(): Promise<CustomerSegmentationDto> {
    const today = new Date();
    return this.cachedMetrics.getCachedCustomerSegmentation(today, async () => {
      try {
        // Get all customers
        const allCustomers = await this.db
          .select({
            id: customers.id,
          })
          .from(customers);

        // Get order counts per customer
        const customerOrders = await this.db
          .select({
            customerId: orders.customerId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(orders)
          .where(eq(orders.archived, false))
          .groupBy(orders.customerId);

        const orderCountMap = new Map(
          customerOrders.map((co) => [co.customerId, Number(co.count)]),
        );

        const newCustomers = allCustomers.filter(
          (c) => !orderCountMap.has(c.id) || orderCountMap.get(c.id) === 1,
        ).length;
        const returningCustomers = allCustomers.filter((c) => {
          const count = orderCountMap.get(c.id);
          return count !== undefined && count > 1;
        }).length;

        const totalCustomers = allCustomers.length;
        const newCustomerPercentage =
          totalCustomers > 0 ? (newCustomers / totalCustomers) * 100 : 0;
        const returningCustomerPercentage =
          totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

        return {
          newCustomers,
          returningCustomers,
          newCustomerPercentage: Math.round(newCustomerPercentage * 10) / 10,
          returningCustomerPercentage:
            Math.round(returningCustomerPercentage * 10) / 10,
        };
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "CustomerSegmentationService.getCustomerSegmentation",
            error,
            {},
          ),
          "Failed to get customer segmentation",
        );
        throw error;
      }
    });
  }

  /**
   * Get RFM analysis (Recency, Frequency, Monetary)
   */
  async getRFMAnalysis(period?: DateRange): Promise<RFMAnalysisDto> {
    const today = new Date();
    return this.cachedMetrics.getCachedRFMAnalysis(today, async () => {
      try {
        const now = new Date();
        const analysisPeriod = period || {
          startDate: new Date(now.getFullYear(), now.getMonth() - 12, 1),
          endDate: now,
        };

        // Get customer RFM data
        const nowTimestamp = now.toISOString();
        const rfmData = await this.db
          .select({
            customerId: orders.customerId,
            recency: sql<number>`EXTRACT(EPOCH FROM (${sql.raw(`'${nowTimestamp}'`)}::timestamp - MAX(${orders.createdAt}))) / 86400`,
            frequency: sql<number>`COUNT(*)::int`,
            monetary: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
          })
          .from(orders)
          .where(
            and(
              gte(orders.createdAt, analysisPeriod.startDate),
              lte(orders.createdAt, analysisPeriod.endDate),
              eq(orders.archived, false),
            ),
          )
          .groupBy(orders.customerId);

        if (rfmData.length === 0) {
          return {
            segments: [],
            totalCustomers: 0,
          };
        }

        // Calculate quartiles for RFM scoring
        const recencyValues = rfmData
          .map((r) => Number(r.recency))
          .sort((a, b) => a - b);
        const frequencyValues = rfmData
          .map((r) => Number(r.frequency))
          .sort((a, b) => a - b);
        const monetaryValues = rfmData
          .map((r) => Number(r.monetary))
          .sort((a, b) => a - b);

        const getQuartile = (value: number, values: number[]): number => {
          if (value <= values[Math.floor(values.length * 0.25)]) return 4;
          if (value <= values[Math.floor(values.length * 0.5)]) return 3;
          if (value <= values[Math.floor(values.length * 0.75)]) return 2;
          return 1;
        };

        // Segment customers
        const segments = new Map<
          string,
          {
            customerCount: number;
            totalRevenue: number;
            customers: number[];
          }
        >();

        rfmData.forEach((customer) => {
          const recency = Number(customer.recency);
          const frequency = Number(customer.frequency);
          const monetary = Number(customer.monetary);

          // Score RFM (1-4, where 4 is best)
          const rScore = 5 - getQuartile(recency, recencyValues); // Lower recency (more recent) is better
          const fScore = getQuartile(frequency, frequencyValues);
          const mScore = getQuartile(monetary, monetaryValues);

          // Determine segment based on scores
          let segment: string;
          if (rScore >= 3 && fScore >= 3 && mScore >= 3) {
            segment = "Champions";
          } else if (rScore >= 3 && fScore >= 2 && mScore >= 2) {
            segment = "Loyal Customers";
          } else if (rScore >= 3 && fScore <= 2 && mScore <= 2) {
            segment = "New Customers";
          } else if (rScore >= 2 && fScore >= 2 && mScore >= 2) {
            segment = "Potential Loyalists";
          } else if (rScore <= 2 && fScore >= 3 && mScore >= 3) {
            segment = "At Risk";
          } else if (rScore <= 2 && fScore <= 2 && mScore <= 2) {
            segment = "Lost";
          } else {
            segment = "Others";
          }

          if (!segments.has(segment)) {
            segments.set(segment, {
              customerCount: 0,
              totalRevenue: 0,
              customers: [],
            });
          }

          const segmentData = segments.get(segment);
          if (!segmentData) {
            throw new Error(`Segment data not found for segment: ${segment}`);
          }
          segmentData.customerCount++;
          segmentData.totalRevenue += monetary;
          segmentData.customers.push(Number(customer.customerId));
        });

        // Convert to DTO format
        const segmentArray: RFMSegmentDto[] = Array.from(
          segments.entries(),
        ).map(([segment, data]) => ({
          segment,
          customerCount: data.customerCount,
          averageRevenue:
            data.customerCount > 0 ? data.totalRevenue / data.customerCount : 0,
          totalRevenue: data.totalRevenue,
        }));

        return {
          segments: segmentArray,
          totalCustomers: rfmData.length,
        };
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "CustomerSegmentationService.getRFMAnalysis",
            error,
            { period },
          ),
          "Failed to get RFM analysis",
        );
        throw error;
      }
    });
  }

  /**
   * Get customer lifetime value
   */
  async getCustomerLifetimeValue(
    customerId: string,
  ): Promise<CustomerLifetimeValueDto | null> {
    try {
      const customer = await this.db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
        })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer[0]) {
        return null;
      }

      const orderStats = await this.db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
          orderCount: sql<number>`COUNT(*)::int`,
        })
        .from(orders)
        .where(
          and(eq(orders.customerId, customerId), eq(orders.archived, false)),
        );

      const { totalRevenue, orderCount } = orderStats[0] || {
        totalRevenue: 0,
        orderCount: 0,
      };

      const avgOrderValue =
        orderCount > 0 ? Number(totalRevenue) / Number(orderCount) : 0;

      // Estimate lifetime value: average order value * expected orders per year * years
      // Simplified: assume 2 years retention, 4 orders per year
      const expectedOrdersPerYear = 4;
      const retentionYears = 2;
      const lifetimeValue =
        avgOrderValue * expectedOrdersPerYear * retentionYears;

      return {
        customerId: customer[0].id,
        customerName: customer[0].name,
        email: customer[0].email,
        totalRevenue: Number(totalRevenue),
        orderCount: Number(orderCount),
        averageOrderValue: Math.round(avgOrderValue * 100) / 100,
        lifetimeValue: Math.round(lifetimeValue * 100) / 100,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomerSegmentationService.getCustomerLifetimeValue",
          error,
          { customerId },
        ),
        "Failed to get customer lifetime value",
      );
      throw error;
    }
  }

  /**
   * Get top customers by revenue
   */
  async getTopCustomers(
    limit: number,
    period: DateRange,
  ): Promise<CustomerLifetimeValueDto[]> {
    return this.cachedMetrics.getCachedTopCustomers(limit, period, async () => {
      try {
        const topCustomers = await this.db
          .select({
            customerId: orders.customerId,
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
          )
          .groupBy(orders.customerId)
          .orderBy(desc(sql`COALESCE(SUM(${orders.total}), 0)`))
          .limit(limit);

        // Get customer details
        const customerIds = topCustomers.map((tc) => tc.customerId);
        const customerDetails =
          customerIds.length > 0
            ? await this.db
                .select({
                  id: customers.id,
                  name: customers.name,
                  email: customers.email,
                })
                .from(customers)
                .where(inArray(customers.id, customerIds))
            : [];

        const customerMap = new Map(customerDetails.map((c) => [c.id, c]));

        return topCustomers.map((tc) => {
          const customer = customerMap.get(tc.customerId);
          const avgOrderValue =
            Number(tc.orderCount) > 0
              ? Number(tc.totalRevenue) / Number(tc.orderCount)
              : 0;
          const lifetimeValue = avgOrderValue * 4 * 2; // Simplified CLV

          return {
            customerId: tc.customerId,
            customerName: customer?.name || "Unknown",
            email: customer?.email || "",
            totalRevenue: Number(tc.totalRevenue),
            orderCount: Number(tc.orderCount),
            averageOrderValue: Math.round(avgOrderValue * 100) / 100,
            lifetimeValue: Math.round(lifetimeValue * 100) / 100,
          };
        });
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "CustomerSegmentationService.getTopCustomers",
            error,
            { limit, period },
          ),
          "Failed to get top customers",
        );
        throw error;
      }
    });
  }

  /**
   * Get customer retention metrics
   */
  async getCustomerRetentionMetrics(
    period: DateRange,
  ): Promise<CustomerRetentionMetricsDto> {
    try {
      // Get customers who made orders in previous period
      const previousPeriodDays =
        (period.endDate.getTime() - period.startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      const previousPeriodStart = new Date(period.startDate);
      previousPeriodStart.setDate(
        previousPeriodStart.getDate() - previousPeriodDays,
      );
      const previousPeriodEnd = new Date(period.startDate);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

      const previousPeriodCustomers = await this.db
        .select({
          customerId: orders.customerId,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, previousPeriodStart),
            lte(orders.createdAt, previousPeriodEnd),
            eq(orders.archived, false),
          ),
        )
        .groupBy(orders.customerId);

      const currentPeriodCustomers = await this.db
        .select({
          customerId: orders.customerId,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, period.startDate),
            lte(orders.createdAt, period.endDate),
            eq(orders.archived, false),
          ),
        )
        .groupBy(orders.customerId);

      const previousCustomerIds = new Set(
        previousPeriodCustomers.map((c) => c.customerId),
      );
      const currentCustomerIds = new Set(
        currentPeriodCustomers.map((c) => c.customerId),
      );

      // Calculate retention
      const retainedCustomers = Array.from(previousCustomerIds).filter((id) =>
        currentCustomerIds.has(id),
      ).length;
      const churnedCustomers = previousCustomerIds.size - retainedCustomers;
      const retentionRate =
        previousCustomerIds.size > 0
          ? (retainedCustomers / previousCustomerIds.size) * 100
          : 0;
      const churnRate =
        previousCustomerIds.size > 0
          ? (churnedCustomers / previousCustomerIds.size) * 100
          : 0;

      // Calculate repeat purchase rate (customers with >1 order in current period)
      const repeatCustomers = currentPeriodCustomers.filter((c) =>
        currentCustomerIds.has(c.customerId),
      ).length;
      const repeatPurchaseRate =
        currentCustomerIds.size > 0
          ? (repeatCustomers / currentCustomerIds.size) * 100
          : 0;

      return {
        retentionRate: Math.round(retentionRate * 10) / 10,
        churnRate: Math.round(churnRate * 10) / 10,
        repeatPurchaseRate: Math.round(repeatPurchaseRate * 10) / 10,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomerSegmentationService.getCustomerRetentionMetrics",
          error,
          { period },
        ),
        "Failed to get customer retention metrics",
      );
      throw error;
    }
  }

  /**
   * Get customer acquisition metrics
   */
  async getCustomerAcquisitionMetrics(
    period: DateRange,
  ): Promise<CustomerAcquisitionMetricsDto> {
    try {
      const newCustomers = await this.db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(customers)
        .where(
          and(
            gte(customers.createdAt, period.startDate),
            lte(customers.createdAt, period.endDate),
          ),
        );

      // Get previous period for comparison
      const previousPeriodDays =
        (period.endDate.getTime() - period.startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      const previousPeriodStart = new Date(period.startDate);
      previousPeriodStart.setDate(
        previousPeriodStart.getDate() - previousPeriodDays,
      );
      const previousPeriodEnd = new Date(period.startDate);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

      const previousPeriodCustomers = await this.db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(customers)
        .where(
          and(
            gte(customers.createdAt, previousPeriodStart),
            lte(customers.createdAt, previousPeriodEnd),
          ),
        );

      const currentCount = Number(newCustomers[0]?.count || 0);
      const previousCount = Number(previousPeriodCustomers[0]?.count || 0);
      const growthPercentage =
        previousCount > 0
          ? ((currentCount - previousCount) / previousCount) * 100
          : 0;

      // Simplified: assume fixed acquisition cost
      const acquisitionCost = 500.0;

      return {
        newCustomers: currentCount,
        newCustomersLastPeriod: previousCount,
        growthPercentage: Math.round(growthPercentage * 10) / 10,
        acquisitionCost,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomerSegmentationService.getCustomerAcquisitionMetrics",
          error,
          { period },
        ),
        "Failed to get customer acquisition metrics",
      );
      throw error;
    }
  }

  /**
   * Get complete customer segmentation analytics
   */
  async getCustomerSegmentationAnalytics(
    period: DateRange,
  ): Promise<CustomerSegmentationResponseDto> {
    const [segmentation, rfmAnalysis, topCustomers, retention, acquisition] =
      await Promise.all([
        this.getCustomerSegmentation(),
        this.getRFMAnalysis(period),
        this.getTopCustomers(10, period),
        this.getCustomerRetentionMetrics(period),
        this.getCustomerAcquisitionMetrics(period),
      ]);

    return {
      segmentation,
      rfmAnalysis,
      topCustomers,
      retention,
      acquisition,
    };
  }
}
