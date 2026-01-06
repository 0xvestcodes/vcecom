import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  and,
  customers,
  eq,
  gte,
  inArray,
  lte,
  orderItems,
  orders,
  products,
  productVariants,
  refunds,
  reviews,
  shipments,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { CustomerSegmentationService } from "../../analytics/services/customer-segmentation.service";
import { OrderAnalyticsService } from "../../analytics/services/order-analytics.service";
import { ProductPerformanceService } from "../../analytics/services/product-performance.service";
import { SalesAnalyticsService } from "../../analytics/services/sales-analytics.service";
import { CustomerSupportDashboardResponseDto } from "../dto/dashboard-customer-support.dto";
import { OperationsDashboardResponseDto } from "../dto/dashboard-operations.dto";
import { OverviewDashboardResponseDto } from "../dto/dashboard-overview.dto";
import { PerformanceDashboardResponseDto } from "../dto/dashboard-performance.dto";
import { ProductMerchandisingDashboardResponseDto } from "../dto/dashboard-product-merchandising.dto";

@Injectable()
export class DashboardService {
  constructor(
    readonly _logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
    private readonly orderAnalytics: OrderAnalyticsService,
    private readonly salesAnalytics: SalesAnalyticsService,
    readonly _customerSegmentation: CustomerSegmentationService,
    private readonly productPerformance: ProductPerformanceService,
  ) {}

  /**
   * Get Performance Dashboard data
   */
  async getPerformanceDashboard(): Promise<PerformanceDashboardResponseDto> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now);
    monthStart.setDate(monthStart.getDate() - 30);
    monthStart.setHours(0, 0, 0, 0);

    // Get all completed orders
    let completedOrders: Array<{
      id: string;
      total: number;
      subtotal: number;
      discountAmount: number;
      gstAmount: number;
      shippingCost: number;
      createdAt: Date;
    }>;
    try {
      completedOrders = await this.db
        .select({
          id: orders.id,
          total: orders.total,
          subtotal: orders.subtotal,
          discountAmount: orders.discountAmount,
          gstAmount: orders.gstAmount,
          shippingCost: orders.shippingCost,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.status, "delivered"));
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getPerformanceDashboard.selectCompletedOrders",
          error,
          {},
        ),
        "Failed to fetch completed orders",
      );
      completedOrders = [];
    }

    // Calculate revenue metrics
    const totalRevenue = completedOrders.reduce(
      (sum, o) => sum + Number(o.total),
      0,
    );
    const totalOrders = completedOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate profit (simplified: revenue - cost, assuming 30% cost margin)
    const estimatedCost = totalRevenue * 0.7; // 70% of revenue is cost
    const totalProfit = totalRevenue - estimatedCost;
    const grossMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const netMargin = grossMargin * 0.9; // Assuming 10% overhead

    // Order volume by period
    const ordersToday = completedOrders.filter(
      (o) => new Date(o.createdAt) >= todayStart,
    ).length;
    const ordersThisWeek = completedOrders.filter(
      (o) => new Date(o.createdAt) >= weekStart,
    ).length;
    const ordersThisMonth = completedOrders.filter(
      (o) => new Date(o.createdAt) >= monthStart,
    ).length;

    // Get refund data
    let refundData: Array<{
      amount: number;
      status: string;
    }>;
    try {
      refundData = await this.db
        .select({
          amount: refunds.amount,
          status: refunds.status,
        })
        .from(refunds);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getPerformanceDashboard.selectRefunds",
          error,
          {},
        ),
        "Failed to fetch refunds",
      );
      refundData = [];
    }

    const totalRefunds = refundData.length;
    const totalRefundAmount = refundData.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0,
    );
    const refundRate = totalOrders > 0 ? (totalRefunds / totalOrders) * 100 : 0;

    // Get cancelled orders
    let cancelledOrders: Array<{ count: number }>;
    try {
      cancelledOrders = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(eq(orders.status, "cancelled"));
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getPerformanceDashboard.selectCancelledOrders",
          error,
          {},
        ),
        "Failed to fetch cancelled orders",
      );
      cancelledOrders = [{ count: 0 }];
    }
    const cancellationRate =
      totalOrders > 0
        ? (Number(cancelledOrders[0]?.count || 0) / totalOrders) * 100
        : 0;

    // Generate trend data (last 30 days)
    const dailyTrends: Array<{ date: string; value: number }> = [];
    const weeklyTrends: Array<{ date: string; value: number }> = [];
    const monthlyTrends: Array<{ date: string; value: number }> = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayRevenue = completedOrders
        .filter(
          (o) =>
            new Date(o.createdAt) >= date && new Date(o.createdAt) < nextDate,
        )
        .reduce((sum, o) => sum + Number(o.total), 0);

      dailyTrends.push({
        date: date.toISOString().split("T")[0],
        value: dayRevenue,
      });
    }

    // Weekly trends (last 12 weeks)
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekRevenue = completedOrders
        .filter(
          (o) =>
            new Date(o.createdAt) >= weekStart &&
            new Date(o.createdAt) < weekEnd,
        )
        .reduce((sum, o) => sum + Number(o.total), 0);

      weeklyTrends.push({
        date: weekStart.toISOString().split("T")[0],
        value: weekRevenue,
      });
    }

    // Monthly trends (last 12 months)
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthRevenue = completedOrders
        .filter(
          (o) =>
            new Date(o.createdAt) >= monthStart &&
            new Date(o.createdAt) < monthEnd,
        )
        .reduce((sum, o) => sum + Number(o.total), 0);

      monthlyTrends.push({
        date: monthStart.toISOString().split("T")[0],
        value: monthRevenue,
      });
    }

    // Traffic sources (simplified - would need analytics integration)
    const trafficSources = [
      {
        source: "Organic",
        visitors: Math.floor(totalOrders * 40),
        revenue: totalRevenue * 0.4,
        conversionRate: 2.5,
      },
      {
        source: "Direct",
        visitors: Math.floor(totalOrders * 30),
        revenue: totalRevenue * 0.3,
        conversionRate: 2.8,
      },
      {
        source: "Social Media",
        visitors: Math.floor(totalOrders * 20),
        revenue: totalRevenue * 0.2,
        conversionRate: 2.0,
      },
      {
        source: "Paid Ads",
        visitors: Math.floor(totalOrders * 10),
        revenue: totalRevenue * 0.1,
        conversionRate: 1.5,
      },
    ];

    // Marketing metrics (simplified - would need marketing data)
    const marketingSpend = totalRevenue * 0.1; // Assume 10% of revenue is marketing
    const cac = totalOrders > 0 ? marketingSpend / totalOrders : 0;
    const roas = marketingSpend > 0 ? (totalRevenue * 0.1) / marketingSpend : 0;

    return {
      revenue: {
        totalRevenue,
        averageOrderValue,
        totalProfit,
        grossMargin,
        netMargin,
      },
      orderVolume: {
        totalOrders,
        ordersToday,
        ordersThisWeek,
        ordersThisMonth,
      },
      conversion: {
        conversionRate: 2.5, // Would need analytics integration
        totalVisitors: totalOrders * 40,
        totalSessions: totalOrders * 45,
      },
      marketing: {
        cac,
        roas,
        marketingSpend,
      },
      refunds: {
        refundRate,
        totalRefunds,
        totalRefundAmount,
        cancellationRate,
      },
      dailyTrends,
      weeklyTrends,
      monthlyTrends,
      trafficSources,
    };
  }

  /**
   * Get Operations Dashboard data
   */
  async getOperationsDashboard(): Promise<OperationsDashboardResponseDto> {
    // Get order status counts
    let statusCounts: Array<{ status: string; count: number }>;
    try {
      statusCounts = await this.db
        .select({
          status: orders.status,
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .groupBy(orders.status);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getOperationsDashboard.selectStatusCounts",
          error,
          {},
        ),
        "Failed to fetch order status counts",
      );
      statusCounts = [];
    }

    const statusMap = statusCounts.reduce(
      (acc, s) => {
        acc[s.status] = Number(s.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get delayed orders (orders that are shipped but not delivered after 5 days)
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    let delayedOrdersData: Array<{
      id: string;
      orderNumber: string;
      status: string;
      createdAt: Date;
    }>;
    try {
      delayedOrdersData = await this.db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(
          and(eq(orders.status, "shipped"), lte(orders.createdAt, fiveDaysAgo)),
        )
        .limit(20);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getOperationsDashboard.selectDelayedOrders",
          error,
          {},
        ),
        "Failed to fetch delayed orders",
      );
      delayedOrdersData = [];
    }

    const delayedOrders = delayedOrdersData.map((order) => {
      const daysDelayed = Math.floor(
        (Date.now() - new Date(order.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const expectedDeliveryDate = new Date(order.createdAt);
      expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 5);

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        daysDelayed,
        status: order.status,
        expectedDeliveryDate: expectedDeliveryDate.toISOString().split("T")[0],
      };
    });

    // Get RTO data (returned shipments)
    let rtoShipments: Array<{ count: number }>;
    try {
      rtoShipments = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(shipments)
        .where(eq(shipments.status, "returned"));
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getOperationsDashboard.selectRtoShipments",
          error,
          {},
        ),
        "Failed to fetch RTO shipments",
      );
      rtoShipments = [{ count: 0 }];
    }

    const totalRtoOrders = Number(rtoShipments[0]?.count || 0);
    let totalOrders: Array<{ count: number }>;
    try {
      totalOrders = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(orders);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getOperationsDashboard.selectTotalOrders",
          error,
          {},
        ),
        "Failed to fetch total orders",
      );
      totalOrders = [{ count: 0 }];
    }
    const rtoRate =
      Number(totalOrders[0]?.count || 0) > 0
        ? (totalRtoOrders / Number(totalOrders[0]?.count || 0)) * 100
        : 0;

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    let rtoThisMonth: Array<{ count: number }>;
    try {
      rtoThisMonth = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(shipments)
        .where(
          and(
            eq(shipments.status, "returned"),
            gte(shipments.createdAt, thisMonthStart),
          ),
        );
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getOperationsDashboard.selectRtoThisMonth",
          error,
          {},
        ),
        "Failed to fetch RTO this month",
      );
      rtoThisMonth = [{ count: 0 }];
    }

    // Inventory aging
    let variants: Array<{
      id: string;
      inventory: number;
      updatedAt: Date;
    }>;
    try {
      variants = await this.db
        .select({
          id: productVariants.id,
          inventory: productVariants.inventory,
          updatedAt: productVariants.updatedAt,
        })
        .from(productVariants);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getOperationsDashboard.selectVariants",
          error,
          {},
        ),
        "Failed to fetch variants",
      );
      variants = [];
    }

    const now = new Date();
    const aging = {
      days0to30: 0,
      days31to60: 0,
      days61to90: 0,
      days90Plus: 0,
    };

    variants.forEach((variant) => {
      if (variant.inventory > 0) {
        const daysSinceUpdate = Math.floor(
          (now.getTime() - new Date(variant.updatedAt).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (daysSinceUpdate <= 30) aging.days0to30++;
        else if (daysSinceUpdate <= 60) aging.days31to60++;
        else if (daysSinceUpdate <= 90) aging.days61to90++;
        else aging.days90Plus++;
      }
    });

    // Out of stock alerts
    let outOfStockVariants: Array<{
      productId: string;
      inventory: number;
      updatedAt: Date;
    }>;
    try {
      outOfStockVariants = await this.db
        .select({
          productId: productVariants.productId,
          inventory: productVariants.inventory,
          updatedAt: productVariants.updatedAt,
        })
        .from(productVariants)
        .where(eq(productVariants.inventory, 0))
        .limit(20);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getOperationsDashboard.selectOutOfStockVariants",
          error,
          {},
        ),
        "Failed to fetch out of stock variants",
      );
      outOfStockVariants = [];
    }

    const productIds = outOfStockVariants.map((v) => v.productId);
    let productTitles: Array<{
      id: string;
      title: string;
    }>;
    try {
      productTitles =
        productIds.length > 0
          ? await this.db
              .select({
                id: products.id,
                title: products.title,
              })
              .from(products)
              .where(inArray(products.id, productIds))
          : [];
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getOperationsDashboard.selectProductTitles",
          error,
          { productIds },
        ),
        "Failed to fetch product titles",
      );
      productTitles = [];
    }

    const titleMap = productTitles.reduce(
      (acc, p) => {
        acc[p.id] = p.title;
        return acc;
      },
      {} as Record<string, string>,
    );

    const outOfStockAlerts = outOfStockVariants.map((variant) => {
      const daysOutOfStock = Math.floor(
        (now.getTime() - new Date(variant.updatedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        productId: variant.productId,
        productTitle: titleMap[variant.productId] || "Unknown Product",
        inventory: variant.inventory,
        daysOutOfStock,
      };
    });

    // Shipping metrics
    let shippedOrders: Array<{
      id: string;
      createdAt: Date;
      shippingProvider: string | null;
    }>;
    try {
      shippedOrders = await this.db
        .select({
          id: orders.id,
          createdAt: orders.createdAt,
          shippingProvider: orders.shippingProvider,
        })
        .from(orders)
        .where(eq(orders.status, "delivered"));
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getOperationsDashboard.selectShippedOrders",
          error,
          {},
        ),
        "Failed to fetch shipped orders",
      );
      shippedOrders = [];
    }

    const shippingTimes: number[] = [];
    const shippingTimesByCourier: Record<string, number[]> = {};

    for (const order of shippedOrders) {
      let shipment: { createdAt: Date; updatedAt: Date } | undefined;
      try {
        const shipmentResult = await this.db
          .select({
            createdAt: shipments.createdAt,
            updatedAt: shipments.updatedAt,
          })
          .from(shipments)
          .where(eq(shipments.orderId, order.id))
          .limit(1);
        shipment = shipmentResult[0];
      } catch (error) {
        this._logger.warn(
          createLogContext(
            this.contextService,
            "DashboardService.getOperationsDashboard.selectShipment",
            {
              orderId: order.id,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to fetch shipment for order",
        );
        continue;
      }

      if (shipment) {
        const shippingTime =
          (new Date(shipment.updatedAt).getTime() -
            new Date(shipment.createdAt).getTime()) /
          (1000 * 60 * 60 * 24);
        shippingTimes.push(shippingTime);

        if (order.shippingProvider) {
          if (!shippingTimesByCourier[order.shippingProvider]) {
            shippingTimesByCourier[order.shippingProvider] = [];
          }
          shippingTimesByCourier[order.shippingProvider].push(shippingTime);
        }
      }
    }

    const averageShippingTime =
      shippingTimes.length > 0
        ? shippingTimes.reduce((sum, t) => sum + t, 0) / shippingTimes.length
        : 0;

    const averageTimeByCourier: Record<string, number> = {};
    Object.keys(shippingTimesByCourier).forEach((courier) => {
      const times = shippingTimesByCourier[courier];
      averageTimeByCourier[courier] =
        times.length > 0
          ? times.reduce((sum, t) => sum + t, 0) / times.length
          : 0;
    });

    // SLA breaches (assuming 5 day SLA)
    const slaBreaches = delayedOrders.length;
    const slaBreachRate =
      shippedOrders.length > 0 ? (slaBreaches / shippedOrders.length) * 100 : 0;

    return {
      orderStatusCounts: {
        pending: statusMap.pending || 0,
        packed: statusMap.packed || 0,
        shipped: statusMap.shipped || 0,
        delivered: statusMap.delivered || 0,
        cancelled: statusMap.cancelled || 0,
      },
      delayedOrders,
      rto: {
        rtoRate,
        totalRtoOrders,
        rtoThisMonth: Number(rtoThisMonth[0]?.count || 0),
      },
      inventoryAging: aging,
      outOfStockAlerts,
      shipping: {
        averageShippingTime,
        averageTimeByCourier,
        slaBreaches,
        slaBreachRate,
      },
    };
  }

  /**
   * Get Customer & Support Dashboard data
   */
  async getCustomerSupportDashboard(): Promise<CustomerSupportDashboardResponseDto> {
    // Customer segmentation
    let allCustomers: Array<typeof customers.$inferSelect>;
    try {
      allCustomers = await this.db.select().from(customers);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getCustomerSupportDashboard.selectCustomers",
          error,
          {},
        ),
        "Failed to fetch customers",
      );
      allCustomers = [];
    }

    let customerOrders: Array<{
      customerId: string;
      count: number;
    }>;
    try {
      customerOrders = await this.db
        .select({
          customerId: orders.customerId,
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .groupBy(orders.customerId);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getCustomerSupportDashboard.selectCustomerOrders",
          error,
          {},
        ),
        "Failed to fetch customer orders",
      );
      customerOrders = [];
    }

    const orderCountMap = customerOrders.reduce(
      (acc, co) => {
        acc[co.customerId] = Number(co.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    const newCustomers = allCustomers.filter(
      (c) => !orderCountMap[c.id] || orderCountMap[c.id] === 1,
    ).length;
    const returningCustomers = allCustomers.filter(
      (c) => orderCountMap[c.id] && orderCountMap[c.id] > 1,
    ).length;

    const totalCustomers = allCustomers.length;
    const newCustomerPercentage =
      totalCustomers > 0 ? (newCustomers / totalCustomers) * 100 : 0;
    const returningCustomerPercentage =
      totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

    // Customer retention
    const customersWithMultipleOrders = Object.values(orderCountMap).filter(
      (count: number) => count > 1,
    ).length;
    const repeatPurchaseRate =
      totalCustomers > 0
        ? (customersWithMultipleOrders / totalCustomers) * 100
        : 0;

    // Calculate CLV (simplified: average order value * average orders per customer)
    let allOrders: Array<{
      total: number;
      customerId: string;
    }>;
    try {
      allOrders = await this.db
        .select({
          total: orders.total,
          customerId: orders.customerId,
        })
        .from(orders)
        .where(eq(orders.status, "delivered"));
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getCustomerSupportDashboard.selectAllOrders",
          error,
          {},
        ),
        "Failed to fetch all orders",
      );
      allOrders = [];
    }

    const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const averageOrderValue =
      allOrders.length > 0 ? totalRevenue / allOrders.length : 0;
    const averageOrdersPerCustomer =
      totalCustomers > 0 ? allOrders.length / totalCustomers : 0;
    const averageClv = averageOrderValue * averageOrdersPerCustomer;

    // Support metrics (simplified - would need support ticket system)
    const supportMetrics = {
      totalTickets: 0,
      openTickets: 0,
      resolvedTickets: 0,
      averageResponseTime: 2.5,
      averageResolutionTime: 24.0,
      firstResponseSla: 85.0,
    };

    // Return reasons (from refunds)
    let refundReasons: Array<{
      reason: string | null;
      count: number;
    }>;
    try {
      refundReasons = await this.db
        .select({
          reason: refunds.reason,
          count: sql<number>`count(*)`,
        })
        .from(refunds)
        .groupBy(refunds.reason);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getCustomerSupportDashboard.selectRefundReasons",
          error,
          {},
        ),
        "Failed to fetch refund reasons",
      );
      refundReasons = [];
    }

    const totalRefunds = refundReasons.reduce(
      (sum, r) => sum + Number(r.count),
      0,
    );

    const returnReasons = refundReasons.map((r) => ({
      reason: r.reason,
      count: Number(r.count),
      percentage: totalRefunds > 0 ? (Number(r.count) / totalRefunds) * 100 : 0,
    }));

    // Complaint trends (simplified - based on refunds per product)
    let productRefunds: Array<{
      productId: string;
      productTitle: string;
      refundCount: number;
    }>;
    try {
      productRefunds = await this.db
        .select({
          productId: products.id,
          productTitle: products.title,
          refundCount: sql<number>`count(*)`,
        })
        .from(refunds)
        .innerJoin(orders, eq(refunds.orderId, orders.id))
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(
          productVariants,
          eq(orderItems.productVariantId, productVariants.id),
        )
        .innerJoin(products, eq(productVariants.productId, products.id))
        .groupBy(products.id, products.title)
        .limit(10);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getCustomerSupportDashboard.selectProductRefunds",
          error,
          {},
        ),
        "Failed to fetch product refunds",
      );
      productRefunds = [];
    }

    let productOrders: Array<{
      productId: string;
      orderCount: number;
    }>;
    try {
      productOrders = await this.db
        .select({
          productId: products.id,
          orderCount: sql<number>`count(*)`,
        })
        .from(orderItems)
        .innerJoin(
          productVariants,
          eq(orderItems.productVariantId, productVariants.id),
        )
        .innerJoin(products, eq(productVariants.productId, products.id))
        .groupBy(products.id);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getCustomerSupportDashboard.selectProductOrders",
          error,
          {},
        ),
        "Failed to fetch product orders",
      );
      productOrders = [];
    }

    const orderCountByProduct = productOrders.reduce(
      (acc, po) => {
        acc[po.productId] = Number(po.orderCount);
        return acc;
      },
      {} as Record<string, number>,
    );

    const complaintTrends = productRefunds.map((pr) => {
      const orderCount = orderCountByProduct[pr.productId] || 1;
      const complaintRate = (Number(pr.refundCount) / orderCount) * 100;
      return {
        productId: pr.productId,
        productTitle: pr.productTitle,
        complaintCount: Number(pr.refundCount),
        complaintRate,
      };
    });

    // Review sentiment
    let reviewData: Array<{
      rating: number;
      count: number;
    }>;
    try {
      reviewData = await this.db
        .select({
          rating: reviews.rating,
          count: sql<number>`count(*)`,
        })
        .from(reviews)
        .where(eq(reviews.status, "approved"))
        .groupBy(reviews.rating);
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getCustomerSupportDashboard.selectReviewData",
          error,
          {},
        ),
        "Failed to fetch review data",
      );
      reviewData = [];
    }

    const totalReviews = reviewData.reduce(
      (sum, r) => sum + Number(r.count),
      0,
    );
    const averageRating =
      totalReviews > 0
        ? reviewData.reduce(
            (sum, r) => sum + Number(r.rating) * Number(r.count),
            0,
          ) / totalReviews
        : 0;

    const positiveReviews = reviewData
      .filter((r) => Number(r.rating) >= 4)
      .reduce((sum, r) => sum + Number(r.count), 0);
    const negativeReviews = reviewData
      .filter((r) => Number(r.rating) <= 2)
      .reduce((sum, r) => sum + Number(r.count), 0);
    const neutralReviews = reviewData
      .filter((r) => Number(r.rating) === 3)
      .reduce((sum, r) => sum + Number(r.count), 0);

    // NPS calculation (simplified)
    const nps =
      totalReviews > 0
        ? ((positiveReviews - negativeReviews) / totalReviews) * 100
        : 0;

    return {
      segmentation: {
        newCustomers,
        returningCustomers,
        newCustomerPercentage,
        returningCustomerPercentage,
      },
      retention: {
        repeatPurchaseRate,
        averageClv,
        customersWithMultipleOrders,
      },
      support: supportMetrics,
      returnReasons: returnReasons.map((r) => ({
        reason: r.reason || "",
        count: r.count,
        percentage: r.percentage,
      })),
      complaintTrends,
      reviewSentiment: {
        averageRating,
        totalReviews,
        positiveReviews,
        negativeReviews,
        neutralReviews,
        nps,
      },
    };
  }

  /**
   * Get Product & Merchandising Dashboard data
   * Uses analytics services for optimized queries
   */
  async getProductMerchandisingDashboard(): Promise<ProductMerchandisingDashboardResponseDto> {
    const now = new Date();
    const period = {
      startDate: new Date(0), // All time
      endDate: now,
    };

    // Use analytics services for optimized queries
    const [
      bestSellingProducts,
      worstSellingProducts,
      categoryPerformance,
      topVariants,
      inventoryTurnover,
    ] = await Promise.all([
      this.productPerformance.getTopSellingProducts(10, period),
      this.productPerformance.getWorstSellingProducts(10, period),
      this.productPerformance.getCategoryPerformance(period),
      this.productPerformance.getVariantPerformance(period, 20),
      this.productPerformance.getInventoryTurnover(period),
    ]);

    // Price elasticity (simplified - would need discount data)
    const priceElasticity = bestSellingProducts.slice(0, 5).map((product) => ({
      productId: product.productId,
      productTitle: product.productTitle,
      discountPercentage: 20.0,
      salesIncrease: 45.0,
      revenueImpact: product.revenue * 0.15,
    }));

    // Conversion funnel (simplified - would need analytics)
    const _conversionFunnel = {
      views: 10000,
      addToCart: 500,
      purchases: 250,
      viewToCartRate: 5.0,
      cartToPurchaseRate: 50.0,
      overallConversionRate: 2.5,
    };

    return {
      bestSellingProducts: bestSellingProducts.map((p) => ({
        productId: p.productId,
        productTitle: p.productTitle,
        revenue: p.revenue,
        unitsSold: p.unitsSold,
        grossMargin: p.grossMargin,
        grossMarginPercentage: p.grossMarginPercentage,
      })),
      worstSellingProducts: worstSellingProducts.map((p) => ({
        productId: p.productId,
        productTitle: p.productTitle,
        revenue: p.revenue,
        unitsSold: p.unitsSold,
        grossMargin: p.grossMargin,
        grossMarginPercentage: p.grossMarginPercentage,
      })),
      categoryPerformance: categoryPerformance.map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        revenue: c.revenue,
        unitsSold: c.unitsSold,
        productCount: c.productCount,
      })),
      topVariants: topVariants.map((v) => ({
        variantId: v.variantId,
        productId: v.productId,
        attributes: v.attributes,
        unitsSold: v.unitsSold,
        revenue: v.revenue,
      })),
      priceElasticity,
      inventoryTurnover: inventoryTurnover.map((i) => ({
        productId: i.productId,
        productTitle: i.productTitle,
        turnoverRate: i.turnoverRate,
        daysToSell: i.daysToSell,
        currentInventory: i.currentInventory,
      })),
      conversionFunnel: {
        views: 10000,
        addToCart: 500,
        purchases: 250,
        viewToCartRate: 5.0,
        cartToPurchaseRate: 50.0,
        overallConversionRate: 2.5,
      },
    };
  }

  /**
   * Get Overview Dashboard data - aggregated key metrics
   * Uses analytics services for optimized queries
   */
  async getOverviewDashboard(): Promise<OverviewDashboardResponseDto> {
    try {
      const now = new Date();
      const monthStart = new Date(now);
      monthStart.setDate(monthStart.getDate() - 30);
      monthStart.setHours(0, 0, 0, 0);

      // Use analytics services for optimized queries
      const [orderMetrics, revenueMetrics, statusBreakdown, refundMetrics] =
        await Promise.all([
          this.orderAnalytics.getOrderMetrics({
            startDate: new Date(0), // All time
            endDate: now,
          }),
          this.salesAnalytics.getRevenueMetrics({
            startDate: monthStart,
            endDate: now,
          }),
          this.orderAnalytics.getOrderStatusBreakdown(),
          this.salesAnalytics.getRefundMetrics({
            startDate: new Date(0),
            endDate: now,
          }),
        ]);

      const totalOrders = orderMetrics.totalOrders;
      const totalRevenue = orderMetrics.totalRevenue;
      const averageOrderValue = orderMetrics.averageOrderValue;
      const monthlyRevenue = revenueMetrics.totalRevenue;
      const ordersToday = orderMetrics.ordersToday;
      const ordersThisWeek = orderMetrics.ordersThisWeek;
      const ordersThisMonth = orderMetrics.ordersThisMonth;

      // Use status breakdown from analytics service
      const statusMap = statusBreakdown.reduce(
        (acc, s) => {
          acc[s.status] = s.count;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Customers
      let allCustomers: Array<typeof customers.$inferSelect>;
      try {
        allCustomers = await this.db.select().from(customers);
      } catch (error) {
        this._logger.error(
          createErrorContext(
            this.contextService,
            "DashboardService.getOverviewDashboard.selectCustomers",
            error,
            {},
          ),
          "Failed to fetch customers",
        );
        allCustomers = [];
      }

      const totalCustomers = allCustomers.length;
      const newCustomersThisMonth = allCustomers.filter(
        (c) => new Date(c.createdAt) >= monthStart,
      ).length;

      // Products
      let allProducts: Array<typeof products.$inferSelect>;
      try {
        allProducts = await this.db.select().from(products);
      } catch (error) {
        this._logger.error(
          createErrorContext(
            this.contextService,
            "DashboardService.getOverviewDashboard.selectProducts",
            error,
            {},
          ),
          "Failed to fetch products",
        );
        allProducts = [];
      }

      const totalProducts = allProducts.length;
      const activeProducts = allProducts.filter(
        (p) => p.status === "active",
      ).length;

      // Out of stock products
      let outOfStockVariants: Array<{
        productId: string;
      }>;
      try {
        outOfStockVariants = await this.db
          .select({
            productId: productVariants.productId,
          })
          .from(productVariants)
          .where(eq(productVariants.inventory, 0));
      } catch (error) {
        this._logger.error(
          createErrorContext(
            this.contextService,
            "DashboardService.getOverviewDashboard.outOfStockVariants",
            error,
            {},
          ),
          "Failed to fetch out of stock variants",
        );
        outOfStockVariants = [];
      }

      const uniqueOutOfStockProducts = new Set(
        outOfStockVariants.map((v) => v.productId),
      ).size;

      // Refunds
      let _refundData: Array<{ count: number }>;
      try {
        _refundData = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(refunds);
      } catch (error) {
        this._logger.error(
          createErrorContext(
            this.contextService,
            "DashboardService.getOverviewDashboard.selectRefunds",
            error,
            {},
          ),
          "Failed to fetch refunds",
        );
        _refundData = [{ count: 0 }];
      }

      const totalRefunds = refundMetrics.totalRefunds;
      const refundRate = refundMetrics.refundRate;

      // Reviews
      let reviewData: Array<{
        rating: number;
        count: number;
      }>;
      try {
        reviewData = await this.db
          .select({
            rating: reviews.rating,
            count: sql<number>`count(*)`,
          })
          .from(reviews)
          .where(eq(reviews.status, "approved"))
          .groupBy(reviews.rating);
      } catch (error) {
        this._logger.error(
          createErrorContext(
            this.contextService,
            "DashboardService.getOverviewDashboard.selectReviews",
            error,
            {},
          ),
          "Failed to fetch reviews",
        );
        reviewData = [];
      }

      const totalReviews = reviewData.reduce(
        (sum, r) => sum + Number(r.count || 0),
        0,
      );
      const averageRating =
        totalReviews > 0
          ? reviewData.reduce(
              (sum, r) => sum + Number(r.rating || 0) * Number(r.count || 0),
              0,
            ) / totalReviews
          : 0;

      return {
        totalRevenue,
        monthlyRevenue,
        averageOrderValue,
        totalOrders,
        ordersToday,
        ordersThisWeek,
        ordersThisMonth,
        totalCustomers,
        newCustomersThisMonth,
        totalProducts,
        activeProducts,
        pendingOrders: statusMap.pending || 0,
        shippedOrders: statusMap.shipped || 0,
        deliveredOrders: statusMap.delivered || 0,
        outOfStockProducts: uniqueOutOfStockProducts,
        totalRefunds,
        refundRate,
        averageRating,
        totalReviews,
      };
    } catch (error) {
      this._logger.error(
        createErrorContext(
          this.contextService,
          "DashboardService.getOverviewDashboard",
          error,
          {},
        ),
        "Failed to get overview dashboard",
      );
      throw new InternalServerErrorException(
        "Failed to retrieve dashboard data",
      );
    }
  }
}
