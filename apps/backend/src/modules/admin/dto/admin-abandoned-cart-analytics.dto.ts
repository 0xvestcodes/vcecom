import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsOptional, Min } from "class-validator";

export class AbandonedCartAnalyticsQueryDto {
  @ApiProperty({
    description: "Start date for analytics (ISO 8601)",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: "End date for analytics (ISO 8601)",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: "Minimum cart value filter",
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minValue?: number;

  @ApiProperty({
    description: "Customer segment filter (customer ID)",
    required: false,
  })
  @IsOptional()
  customerId?: string;
}

export class AbandonedCartStatsDto {
  @ApiProperty({
    description: "Total number of abandoned carts",
    example: 150,
  })
  totalAbandoned: number;

  @ApiProperty({
    description: "Total number of recovered carts",
    example: 45,
  })
  totalRecovered: number;

  @ApiProperty({
    description: "Recovery rate percentage",
    example: 30.0,
  })
  recoveryRate: number;

  @ApiProperty({
    description: "Total revenue recovered (in INR)",
    example: 125000.0,
  })
  totalRevenueRecovered: number;

  @ApiProperty({
    description: "Average cart value",
    example: 2500.0,
  })
  averageCartValue: number;

  @ApiProperty({
    description: "Average recovery time in hours",
    example: 24.5,
  })
  averageRecoveryTime: number;
}

export class AbandonedCartAnalyticsDto {
  @ApiProperty({
    description: "Abandoned carts over time (daily breakdown)",
    type: Array,
  })
  abandonedOverTime: Array<{
    date: string;
    count: number;
    totalValue: number;
  }>;

  @ApiProperty({
    description: "Recovery rate over time",
    type: Array,
  })
  recoveryRateOverTime: Array<{
    date: string;
    recoveryRate: number;
  }>;

  @ApiProperty({
    description: "Recovery attempts breakdown",
    type: Object,
  })
  recoveryAttemptsBreakdown: {
    emailSent: number;
    smsSent: number;
    recovered: number;
    expired: number;
    failed: number;
  };

  @ApiProperty({
    description: "Top abandoned products",
    type: Array,
  })
  topAbandonedProducts: Array<{
    productId: string;
    productName: string;
    abandonCount: number;
  }>;
}

export class RecoveryCampaignStatsDto {
  @ApiProperty({
    description: "Campaign ID",
    example: "campaign-123",
  })
  campaignId: string;

  @ApiProperty({
    description: "Total carts in campaign",
    example: 100,
  })
  totalCarts: number;

  @ApiProperty({
    description: "Emails sent",
    example: 80,
  })
  emailsSent: number;

  @ApiProperty({
    description: "SMS sent",
    example: 60,
  })
  smsSent: number;

  @ApiProperty({
    description: "Carts recovered",
    example: 25,
  })
  recovered: number;

  @ApiProperty({
    description: "Recovery rate",
    example: 25.0,
  })
  recoveryRate: number;

  @ApiProperty({
    description: "Total revenue recovered",
    example: 62500.0,
  })
  totalRevenueRecovered: number;
}
