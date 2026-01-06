import { ApiProperty } from "@nestjs/swagger";

export class OrderMetricsDto {
  @ApiProperty({ description: "Total orders", example: 1500 })
  totalOrders: number;

  @ApiProperty({ description: "Total revenue", example: 3750000.0 })
  totalRevenue: number;

  @ApiProperty({ description: "Average order value", example: 2500.0 })
  averageOrderValue: number;

  @ApiProperty({ description: "Orders today", example: 25 })
  ordersToday: number;

  @ApiProperty({ description: "Orders this week", example: 175 })
  ordersThisWeek: number;

  @ApiProperty({ description: "Orders this month", example: 600 })
  ordersThisMonth: number;
}

export class OrderStatusBreakdownDto {
  @ApiProperty({ description: "Order status", example: "pending" })
  status: string;

  @ApiProperty({ description: "Count of orders", example: 50 })
  count: number;

  @ApiProperty({ description: "Total revenue for status", example: 125000.0 })
  revenue: number;
}

export class OrderTrendDataPointDto {
  @ApiProperty({ description: "Date", example: "2024-01-15" })
  date: string;

  @ApiProperty({ description: "Order count", example: 25 })
  orders: number;

  @ApiProperty({ description: "Revenue", example: 62500.0 })
  revenue: number;
}

export class OrderFulfillmentMetricsDto {
  @ApiProperty({
    description: "Average fulfillment time in hours",
    example: 48.5,
  })
  averageFulfillmentTime: number;

  @ApiProperty({ description: "Orders fulfilled on time", example: 450 })
  onTimeFulfillments: number;

  @ApiProperty({ description: "Orders delayed", example: 50 })
  delayedFulfillments: number;

  @ApiProperty({
    description: "On-time fulfillment rate percentage",
    example: 90.0,
  })
  onTimeRate: number;
}

export class OrderAnalyticsResponseDto {
  @ApiProperty({ type: OrderMetricsDto })
  metrics: OrderMetricsDto;

  @ApiProperty({ type: [OrderStatusBreakdownDto] })
  statusBreakdown: OrderStatusBreakdownDto[];

  @ApiProperty({ type: [OrderTrendDataPointDto] })
  trends: OrderTrendDataPointDto[];

  @ApiProperty({ type: OrderFulfillmentMetricsDto, required: false })
  fulfillmentMetrics?: OrderFulfillmentMetricsDto;
}
