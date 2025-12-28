import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserBundleSelection } from "../../bundles/services/bundle-eligibility.service";

/**
 * Price breakdown details for cart items
 */
export class PriceBreakdownDto {
  @ApiProperty({
    description: "Current unit price after all discounts",
    example: 899.99,
    type: Number,
  })
  unitPrice: number;

  @ApiProperty({
    description: "Total for this line item (unitPrice * quantity)",
    example: 1799.98,
    type: Number,
  })
  lineTotal: number;

  @ApiProperty({
    description: "Base price before discounts",
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
    type: Object,
    example: {
      salePrice: {
        amount: 899.99,
        label: "Black Friday Sale",
      },
      priceListDiscount: {
        amount: 50.0,
        listName: "VIP Members",
      },
      savings: 150.0,
      savingsPercentage: 15.01,
    },
  })
  breakdown: {
    salePrice?: { amount: number; label: string };
    priceListDiscount?: { amount: number; listName: string };
    savings: number;
    savingsPercentage: number;
  };
}

/**
 * Bundle variant breakdown (for bundle items)
 */
export class BundleVariantBreakdownDto {
  @ApiProperty({
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  variantId: string;

  @ApiProperty({
    description: "Unit price for this variant",
    example: 999.99,
    type: Number,
  })
  unitPrice: number;

  @ApiProperty({
    description: "Quantity of this variant in the bundle",
    example: 1,
    type: Number,
  })
  quantity: number;
}

/**
 * Enriched cart item with complete product data and pricing
 */
export class EnrichedCartItemDto {
  @ApiProperty({
    description: "Cart item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Item type",
    enum: ["variant", "bundle"],
    example: "variant",
  })
  type: "variant" | "bundle";

  @ApiProperty({ description: "Quantity", example: 2 })
  quantity: number;

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
    description: "Variant title (e.g., size/color combination)",
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
    description: "Pricing details with breakdown",
    type: PriceBreakdownDto,
  })
  pricing: PriceBreakdownDto;

  @ApiProperty({
    description: "Inventory status",
    enum: ["in_stock", "low_stock", "out_of_stock"],
    example: "in_stock",
  })
  inventoryStatus: string;

  @ApiProperty({
    description: "Available quantity",
    example: 50,
  })
  availableQuantity: number;

  @ApiProperty({
    description: "GST rate percentage",
    example: 18,
  })
  gstRate: number;

  // Bundle fields
  @ApiPropertyOptional({
    description: "Bundle ID (if this is a bundle item)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  bundleId?: string;

  @ApiPropertyOptional({
    description: "Bundle title",
    example: "Summer Collection Bundle",
  })
  bundleTitle?: string;

  @ApiPropertyOptional({
    description: "Bundle set ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  bundleSetId?: string;

  @ApiPropertyOptional({
    description: "Bundle selections (if this is a bundle item)",
    type: Object,
    example: {
      "set-1": ["variant-1"],
      "set-2": ["variant-2"],
    },
  })
  selections?: UserBundleSelection;

  @ApiPropertyOptional({
    description: "Bundle variant breakdown (if this is a bundle item)",
    type: [BundleVariantBreakdownDto],
  })
  bundleVariantBreakdown?: BundleVariantBreakdownDto[];

  // State fields
  @ApiPropertyOptional({
    description: "Item state",
    enum: ["fresh", "stale", "reacquired", "committed"],
    example: "fresh",
  })
  state?: string;

  @ApiPropertyOptional({
    description: "Whether inventory reservation is stale",
    example: false,
  })
  isStale?: boolean;

  @ApiProperty({ description: "Created timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated timestamp" })
  updatedAt: Date;
}
