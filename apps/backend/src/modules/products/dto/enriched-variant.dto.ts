import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Enriched variant data with complete product information
 * Ready for frontend display without additional API calls
 */
export class EnrichedVariantDto {
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
    example: "Premium Cotton T-Shirt",
  })
  productTitle: string;

  @ApiPropertyOptional({
    description: "Product slug for URL generation",
    example: "premium-cotton-t-shirt",
  })
  productSlug?: string;

  @ApiPropertyOptional({
    description: "Product description",
    example: "A comfortable and stylish cotton t-shirt",
    nullable: true,
  })
  productDescription: string | null;

  @ApiPropertyOptional({
    description: "Variant title (e.g., size/color combination)",
    example: "Large / Blue",
    nullable: true,
  })
  variantTitle: string | null;

  @ApiProperty({
    description: "SKU (Stock Keeping Unit)",
    example: "TS-BLU-L-001",
  })
  sku: string;

  @ApiProperty({
    description: "Variant attributes as key-value pairs",
    example: { size: "L", color: "Blue", material: "Cotton" },
    type: Object,
  })
  attributes: Record<string, string>;

  @ApiProperty({
    description: "Base price before any discounts",
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
    description: "Currency code",
    example: "INR",
    default: "INR",
  })
  currency: string;

  @ApiPropertyOptional({
    description: "Thumbnail image URL (variant-specific or product fallback)",
    example: "https://cdn.example.com/images/tshirt-blue-thumb.jpg",
    nullable: true,
  })
  thumbnail: string | null;

  @ApiProperty({
    description:
      "All images for this variant (variant-specific + product images)",
    type: [String],
    example: [
      "https://cdn.example.com/images/tshirt-blue-1.jpg",
      "https://cdn.example.com/images/tshirt-blue-2.jpg",
    ],
  })
  images: string[];

  @ApiProperty({
    description: "Current inventory quantity",
    example: 50,
    type: Number,
  })
  inventoryQuantity: number;

  @ApiProperty({
    description: "Inventory status",
    enum: ["in_stock", "low_stock", "out_of_stock"],
    example: "in_stock",
  })
  inventoryStatus: "in_stock" | "low_stock" | "out_of_stock";

  @ApiProperty({
    description: "GST rate percentage",
    example: 18,
    type: Number,
  })
  gstRate: number;

  @ApiPropertyOptional({
    description: "HSN code for GST",
    example: "6109",
    nullable: true,
  })
  hsnCode: string | null;

  @ApiProperty({
    description: "Whether product is digital",
    example: false,
    type: Boolean,
  })
  isDigital: boolean;

  @ApiProperty({
    description: "Whether product is a preorder",
    example: false,
    type: Boolean,
  })
  isPreorder: boolean;
}
