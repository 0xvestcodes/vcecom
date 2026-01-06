import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { CachedMetricsService } from "../services/cached-metrics.service";
import { CustomerSegmentationService } from "../services/customer-segmentation.service";
import { OrderAnalyticsService } from "../services/order-analytics.service";
import { ProductPerformanceService } from "../services/product-performance.service";
import { SalesAnalyticsService } from "../services/sales-analytics.service";

export interface AnalyticsWarmupJobData {
  triggeredBy?: string;
  type?: "hourly" | "daily" | "weekly";
}

@Injectable()
export class AnalyticsWarmupWorker {
  constructor(
    private readonly orderAnalytics: OrderAnalyticsService,
    private readonly salesAnalytics: SalesAnalyticsService,
    private readonly customerSegmentation: CustomerSegmentationService,
    private readonly productPerformance: ProductPerformanceService,
    readonly _cachedMetrics: CachedMetricsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Compute order metrics
   */
  async computeOrderMetrics(): Promise<void> {
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

      // Warm cache for different periods
      await Promise.all([
        this.orderAnalytics.getOrderMetrics({
          startDate: todayStart,
          endDate: now,
        }),
        this.orderAnalytics.getOrderMetrics({
          startDate: weekStart,
          endDate: now,
        }),
        this.orderAnalytics.getOrderMetrics({
          startDate: monthStart,
          endDate: now,
        }),
      ]);

      this.logger.debug(
        createLogContext(this.contextService, "computeOrderMetrics", {}),
        "Order metrics computed and cached",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "computeOrderMetrics",
          error,
          {},
        ),
        "Failed to compute order metrics",
      );
      throw error;
    }
  }

  /**
   * Compute sales metrics
   */
  async computeSalesMetrics(): Promise<void> {
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

      // Warm cache for different periods
      await Promise.all([
        this.salesAnalytics.getRevenueMetrics({
          startDate: todayStart,
          endDate: now,
        }),
        this.salesAnalytics.getRevenueMetrics({
          startDate: weekStart,
          endDate: now,
        }),
        this.salesAnalytics.getRevenueMetrics({
          startDate: monthStart,
          endDate: now,
        }),
        this.salesAnalytics.getRevenueByCategory({
          startDate: monthStart,
          endDate: now,
        }),
        this.salesAnalytics.getRevenueByPaymentMethod({
          startDate: monthStart,
          endDate: now,
        }),
      ]);

      this.logger.debug(
        createLogContext(this.contextService, "computeSalesMetrics", {}),
        "Sales metrics computed and cached",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "computeSalesMetrics",
          error,
          {},
        ),
        "Failed to compute sales metrics",
      );
      throw error;
    }
  }

  /**
   * Compute customer segmentation
   */
  async computeCustomerSegmentation(): Promise<void> {
    try {
      await Promise.all([
        this.customerSegmentation.getCustomerSegmentation(),
        this.customerSegmentation.getRFMAnalysis(),
      ]);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "computeCustomerSegmentation",
          {},
        ),
        "Customer segmentation computed and cached",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "computeCustomerSegmentation",
          error,
          {},
        ),
        "Failed to compute customer segmentation",
      );
      throw error;
    }
  }

  /**
   * Compute RFM analysis
   */
  async computeRFMAnalysis(): Promise<void> {
    try {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);

      await this.customerSegmentation.getRFMAnalysis({
        startDate: yearStart,
        endDate: now,
      });

      this.logger.debug(
        createLogContext(this.contextService, "computeRFMAnalysis", {}),
        "RFM analysis computed and cached",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "computeRFMAnalysis",
          error,
          {},
        ),
        "Failed to compute RFM analysis",
      );
      throw error;
    }
  }

  /**
   * Compute product performance
   */
  async computeProductPerformance(): Promise<void> {
    try {
      const now = new Date();
      const monthStart = new Date(now);
      monthStart.setDate(monthStart.getDate() - 30);
      monthStart.setHours(0, 0, 0, 0);

      await Promise.all([
        this.productPerformance.getTopSellingProducts(10, {
          startDate: monthStart,
          endDate: now,
        }),
        this.productPerformance.getCategoryPerformance({
          startDate: monthStart,
          endDate: now,
        }),
        this.productPerformance.getVariantPerformance({
          startDate: monthStart,
          endDate: now,
        }),
        this.productPerformance.getInventoryTurnover({
          startDate: monthStart,
          endDate: now,
        }),
      ]);

      this.logger.debug(
        createLogContext(this.contextService, "computeProductPerformance", {}),
        "Product performance computed and cached",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "computeProductPerformance",
          error,
          {},
        ),
        "Failed to compute product performance",
      );
      throw error;
    }
  }

  /**
   * Process warmup job based on job name
   */
  async processWarmupJob(jobName: string): Promise<void> {
    switch (jobName) {
      case "compute-order-metrics":
        await this.computeOrderMetrics();
        break;
      case "compute-sales-metrics":
        await this.computeSalesMetrics();
        break;
      case "compute-customer-segmentation":
        await this.computeCustomerSegmentation();
        break;
      case "compute-rfm-analysis":
        await this.computeRFMAnalysis();
        break;
      case "compute-product-performance":
        await this.computeProductPerformance();
        break;
      default:
        this.logger.warn(
          createLogContext(this.contextService, "processWarmupJob", {
            jobName,
          }),
          `Unknown analytics warmup job: ${jobName}`,
        );
    }
  }
}
