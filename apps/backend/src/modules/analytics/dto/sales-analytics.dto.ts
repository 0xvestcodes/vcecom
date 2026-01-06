import { ApiProperty } from "@nestjs/swagger";

export class RevenueMetricsDto {
  @ApiProperty({ description: "Total revenue", example: 5000000.0 })
  totalRevenue: number;

  @ApiProperty({ description: "Average order value", example: 2500.0 })
  averageOrderValue: number;

  @ApiProperty({ description: "Revenue growth percentage", example: 15.5 })
  growthPercentage: number;
}

export class PeriodComparisonDto {
  @ApiProperty({ description: "Period name", example: "January 2024" })
  period: string;

  @ApiProperty({ description: "Revenue for period", example: 500000.0 })
  revenue: number;

  @ApiProperty({ description: "Orders for period", example: 200 })
  orders: number;

  @ApiProperty({
    description: "Change percentage from previous period",
    example: 10.5,
  })
  changePercentage: number;
}

export class RevenueByCategoryDto {
  @ApiProperty({ description: "Category ID", example: "cat-123" })
  categoryId: string;

  @ApiProperty({ description: "Category name", example: "Electronics" })
  categoryName: string;

  @ApiProperty({ description: "Revenue", example: 1500000.0 })
  revenue: number;

  @ApiProperty({ description: "Units sold", example: 600 })
  unitsSold: number;

  @ApiProperty({ description: "Percentage of total revenue", example: 30.0 })
  percentage: number;
}

export class RevenueByPaymentMethodDto {
  @ApiProperty({ description: "Payment method", example: "razorpay" })
  paymentMethod: string;

  @ApiProperty({ description: "Revenue", example: 3000000.0 })
  revenue: number;

  @ApiProperty({ description: "Order count", example: 1200 })
  orderCount: number;

  @ApiProperty({ description: "Percentage of total revenue", example: 60.0 })
  percentage: number;
}

export class RefundMetricsDto {
  @ApiProperty({ description: "Total refunds", example: 30 })
  totalRefunds: number;

  @ApiProperty({ description: "Total refund amount", example: 75000.0 })
  totalRefundAmount: number;

  @ApiProperty({ description: "Refund rate percentage", example: 2.0 })
  refundRate: number;

  @ApiProperty({ description: "Average refund amount", example: 2500.0 })
  averageRefundAmount: number;
}

export class ProfitMetricsDto {
  @ApiProperty({ description: "Total profit", example: 1500000.0 })
  totalProfit: number;

  @ApiProperty({ description: "Gross margin percentage", example: 30.0 })
  grossMargin: number;

  @ApiProperty({ description: "Net margin percentage", example: 25.0 })
  netMargin: number;
}

export class SalesAnalyticsResponseDto {
  @ApiProperty({ type: RevenueMetricsDto })
  revenue: RevenueMetricsDto;

  @ApiProperty({ type: [PeriodComparisonDto] })
  periodComparisons: PeriodComparisonDto[];

  @ApiProperty({ type: [RevenueByCategoryDto] })
  revenueByCategory: RevenueByCategoryDto[];

  @ApiProperty({ type: [RevenueByPaymentMethodDto] })
  revenueByPaymentMethod: RevenueByPaymentMethodDto[];

  @ApiProperty({ type: RefundMetricsDto })
  refunds: RefundMetricsDto;

  @ApiProperty({ type: ProfitMetricsDto, required: false })
  profit?: ProfitMetricsDto;
}
