import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BundleSetItemResponseDto {
  @ApiProperty({
    description: "Item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

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
    description: "Product slug",
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
    description: "Product/variant thumbnail URL (variant-specific or product fallback)",
    example: "https://cdn.example.com/images/tshirt-blue-thumb.jpg",
    nullable: true,
  })
  thumbnail: string | null;

  @ApiProperty({
    description: "Base price",
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

  @ApiProperty({
    description: "Created at timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  createdAt: Date;
}
