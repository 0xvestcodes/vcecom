import { ApiProperty } from "@nestjs/swagger";

export class CustomerSegmentationDto {
  @ApiProperty({ description: "New customers count", example: 450 })
  newCustomers: number;

  @ApiProperty({ description: "Returning customers count", example: 150 })
  returningCustomers: number;

  @ApiProperty({ description: "New customer percentage", example: 75.0 })
  newCustomerPercentage: number;

  @ApiProperty({ description: "Returning customer percentage", example: 25.0 })
  returningCustomerPercentage: number;
}

export class RFMSegmentDto {
  @ApiProperty({ description: "Segment name", example: "Champions" })
  segment: string;

  @ApiProperty({ description: "Customer count", example: 200 })
  customerCount: number;

  @ApiProperty({ description: "Average revenue per customer", example: 5000.0 })
  averageRevenue: number;

  @ApiProperty({ description: "Total revenue", example: 1000000.0 })
  totalRevenue: number;
}

export class RFMAnalysisDto {
  @ApiProperty({ type: [RFMSegmentDto] })
  segments: RFMSegmentDto[];

  @ApiProperty({ description: "Total customers analyzed", example: 1000 })
  totalCustomers: number;
}

export class CustomerLifetimeValueDto {
  @ApiProperty({ description: "Customer ID", example: "cust-123" })
  customerId: string;

  @ApiProperty({ description: "Customer name", example: "John Doe" })
  customerName: string;

  @ApiProperty({ description: "Customer email", example: "john@example.com" })
  email: string;

  @ApiProperty({ description: "Total revenue from customer", example: 15000.0 })
  totalRevenue: number;

  @ApiProperty({ description: "Number of orders", example: 5 })
  orderCount: number;

  @ApiProperty({ description: "Average order value", example: 3000.0 })
  averageOrderValue: number;

  @ApiProperty({ description: "Estimated lifetime value", example: 20000.0 })
  lifetimeValue: number;
}

export class CustomerRetentionMetricsDto {
  @ApiProperty({ description: "Retention rate percentage", example: 65.0 })
  retentionRate: number;

  @ApiProperty({ description: "Churn rate percentage", example: 35.0 })
  churnRate: number;

  @ApiProperty({
    description: "Repeat purchase rate percentage",
    example: 40.0,
  })
  repeatPurchaseRate: number;
}

export class CustomerAcquisitionMetricsDto {
  @ApiProperty({ description: "New customers this period", example: 100 })
  newCustomers: number;

  @ApiProperty({ description: "New customers last period", example: 80 })
  newCustomersLastPeriod: number;

  @ApiProperty({ description: "Growth percentage", example: 25.0 })
  growthPercentage: number;

  @ApiProperty({ description: "Customer acquisition cost", example: 500.0 })
  acquisitionCost: number;
}

export class CustomerSegmentationResponseDto {
  @ApiProperty({ type: CustomerSegmentationDto })
  segmentation: CustomerSegmentationDto;

  @ApiProperty({ type: RFMAnalysisDto })
  rfmAnalysis: RFMAnalysisDto;

  @ApiProperty({ type: [CustomerLifetimeValueDto] })
  topCustomers: CustomerLifetimeValueDto[];

  @ApiProperty({ type: CustomerRetentionMetricsDto })
  retention: CustomerRetentionMetricsDto;

  @ApiProperty({ type: CustomerAcquisitionMetricsDto })
  acquisition: CustomerAcquisitionMetricsDto;
}
