import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Price breakdown details showing all discounts applied
 */
export class PriceBreakdownDto {
  @ApiProperty({
    description: "Base price before any discounts",
    example: 999.99,
    type: Number,
  })
  basePrice: number;

  @ApiPropertyOptional({
    description: "Sale price information if active",
    type: Object,
    example: {
      amount: 899.99,
      startDate: "2025-01-01T00:00:00.000Z",
      endDate: "2025-12-31T23:59:59.999Z",
      label: "Black Friday Sale",
    },
    nullable: true,
  })
  salePrice?: {
    amount: number;
    startDate: Date;
    endDate: Date;
    label?: string;
  } | null;

  @ApiPropertyOptional({
    description: "Price list discount information if applied",
    type: Object,
    example: {
      listName: "VIP Members",
      listId: "123e4567-e89b-12d3-a456-426614174000",
      type: "PERCENTAGE",
      amount: 100.0,
      originalPrice: 999.99,
      discountedPrice: 899.99,
    },
    nullable: true,
  })
  priceListDiscount?: {
    listName: string;
    listId: string;
    type: "FIXED" | "PERCENTAGE";
    amount: number;
    originalPrice: number;
    discountedPrice: number;
  } | null;

  @ApiPropertyOptional({
    description: "Customer group discount information if applied",
    type: Object,
    example: {
      groupName: "VIP",
      amount: 50.0,
    },
    nullable: true,
  })
  customerGroupDiscount?: {
    groupName: string;
    amount: number;
  } | null;

  @ApiProperty({
    description: "Total savings amount",
    example: 150.0,
    type: Number,
  })
  totalSavings: number;

  @ApiProperty({
    description: "Savings as percentage",
    example: 15.01,
    type: Number,
  })
  savingsPercentage: number;
}

/**
 * Applied price list information
 */
export class AppliedPriceListDto {
  @ApiProperty({
    description: "Price list ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Price list name",
    example: "VIP Members",
  })
  name: string;

  @ApiProperty({
    description: "Price list type",
    example: "B2B",
    enum: ["B2C", "B2B", "WHOLESALE", "RETAIL", "CUSTOM"],
  })
  type: string;
}

/**
 * Resolved price result with detailed breakdown
 */
export class ResolvedPriceDto {
  @ApiProperty({
    description: "Final price after all discounts (best price)",
    example: 849.99,
    type: Number,
  })
  finalPrice: number;

  @ApiProperty({
    description: "Base price from product variant",
    example: 999.99,
    type: Number,
  })
  basePrice: number;

  @ApiPropertyOptional({
    description: "Compare at price (original MSRP)",
    example: 1299.99,
    nullable: true,
    type: Number,
  })
  compareAtPrice: number | null;

  @ApiProperty({
    description: "Detailed price breakdown",
    type: PriceBreakdownDto,
  })
  breakdown: PriceBreakdownDto;

  @ApiPropertyOptional({
    description: "Applied price list information if any",
    type: AppliedPriceListDto,
    nullable: true,
  })
  appliedPriceList?: AppliedPriceListDto | null;
}
