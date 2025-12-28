import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Price snapshot at order creation time (immutable)
 */
export class PricingSnapshotDto {
  @ApiProperty({
    description: "Base price at order time",
    example: 999.99,
    type: Number,
  })
  basePrice: number;

  @ApiPropertyOptional({
    description: "Compare at price",
    example: 1299.99,
    nullable: true,
    type: Number,
  })
  compareAtPrice: number | null;

  @ApiPropertyOptional({
    description: "Applied sale price at order time",
    type: Object,
    example: {
      amount: 899.99,
      label: "Black Friday Sale",
    },
  })
  appliedSale?: {
    amount: number;
    label: string;
  };

  @ApiPropertyOptional({
    description: "Applied price list at order time",
    type: Object,
    example: {
      name: "VIP Members",
      amount: 849.99,
    },
  })
  appliedPriceList?: {
    name: string;
    amount: number;
  };

  @ApiProperty({
    description: "Total savings at order time",
    example: 150.0,
    type: Number,
  })
  savings: number;
}

/**
 * GST breakdown for order item
 */
export class OrderItemGstBreakdownDto {
  @ApiProperty({ description: "CGST amount", example: 81.0, type: Number })
  cgst: number;

  @ApiProperty({ description: "SGST amount", example: 81.0, type: Number })
  sgst: number;

  @ApiProperty({ description: "IGST amount", example: 0, type: Number })
  igst: number;
}

/**
 * Enriched order item with complete product data
 */
export class EnrichedOrderItemDto {
  @ApiProperty({
    description: "Order item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  orderId: string;

  @ApiProperty({
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  variantId: string;

  @ApiProperty({
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  productId: string;

  @ApiProperty({
    description: "Product title",
    example: "Premium T-Shirt",
  })
  productTitle: string;

  @ApiProperty({
    description: "Product slug for URL",
    example: "premium-t-shirt",
  })
  productSlug: string;

  @ApiPropertyOptional({
    description: "Variant title",
    example: "Large / Blue",
    nullable: true,
  })
  variantTitle: string | null;

  @ApiProperty({
    description: "SKU",
    example: "TS-BLU-L",
  })
  sku: string;

  @ApiProperty({
    description: "Variant attributes",
    example: { size: "L", color: "Blue" },
    type: Object,
  })
  attributes: Record<string, string>;

  @ApiPropertyOptional({
    description: "Product/variant thumbnail URL",
    example: "https://cdn.example.com/images/tshirt-blue-thumb.jpg",
    nullable: true,
  })
  thumbnail: string | null;

  @ApiProperty({
    description: "Quantity ordered",
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: "Unit price at order time",
    example: 899.99,
    type: Number,
  })
  unitPrice: number;

  @ApiProperty({
    description: "Line total (unitPrice * quantity)",
    example: 1799.98,
    type: Number,
  })
  lineTotal: number;

  @ApiPropertyOptional({
    description: "Price snapshot at order creation (immutable)",
    type: PricingSnapshotDto,
  })
  pricingSnapshot?: PricingSnapshotDto;

  @ApiProperty({
    description: "GST rate percentage",
    example: 18,
    type: Number,
  })
  gstRate: number;

  @ApiProperty({
    description: "GST amount for this line item",
    example: 323.99,
    type: Number,
  })
  gstAmount: number;

  @ApiProperty({
    description: "GST breakdown",
    type: OrderItemGstBreakdownDto,
  })
  gstBreakdown: OrderItemGstBreakdownDto;

  @ApiPropertyOptional({
    description: "Bundle ID (if this was part of a bundle)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  bundleId?: string;

  @ApiPropertyOptional({
    description: "Bundle title",
    example: "Summer Collection Bundle",
  })
  bundleTitle?: string;

  @ApiProperty({
    description: "Created timestamp",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Updated timestamp",
  })
  updatedAt: Date;
}

