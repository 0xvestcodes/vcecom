import { ApiProperty } from "@nestjs/swagger";
import { PriceListOverrideType, PriceListType } from "./create-price-list.dto";

export class PriceListItemResponseDto {
  @ApiProperty({
    description: "Price list item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Price list ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  priceListId: string;

  @ApiProperty({
    description: "Product variant ID (if variant-specific)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  productVariantId: string | null;

  @ApiProperty({
    description: "Product ID (if product-level)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  productId: string | null;

  @ApiProperty({
    description: "Category ID (if category-level)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  categoryId: string | null;

  @ApiProperty({
    description:
      "Currency code (null = applies to all currencies for this price list)",
    example: "USD",
    nullable: true,
    required: false,
  })
  currency?: string | null;

  @ApiProperty({
    description: "Override type",
    example: PriceListOverrideType.PERCENTAGE,
    enum: PriceListOverrideType,
  })
  overrideType: PriceListOverrideType;

  @ApiProperty({
    description: "Override value",
    example: 10,
  })
  overrideValue: number;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}

export class PriceListResponseDto {
  @ApiProperty({
    description: "Price list ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Price list name",
    example: "B2B Corporate Pricing",
  })
  name: string;

  @ApiProperty({
    description: "Price list description",
    example: "Special pricing for corporate customers",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Price list type",
    example: PriceListType.B2B,
    enum: PriceListType,
  })
  type: PriceListType;

  @ApiProperty({
    description: "Priority (higher number = higher priority)",
    example: 10,
  })
  priority: number;

  @ApiProperty({
    description: "Whether price list is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Currency code (null = applies to all currencies)",
    example: "USD",
    nullable: true,
    required: false,
  })
  currency?: string | null;

  @ApiProperty({
    description: "Start date",
    example: "2025-01-01T00:00:00.000Z",
    nullable: true,
  })
  startDate: Date | null;

  @ApiProperty({
    description: "End date",
    example: "2025-12-31T23:59:59.999Z",
    nullable: true,
  })
  endDate: Date | null;

  @ApiProperty({
    description: "Price list items",
    type: [PriceListItemResponseDto],
  })
  items: PriceListItemResponseDto[];

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}
