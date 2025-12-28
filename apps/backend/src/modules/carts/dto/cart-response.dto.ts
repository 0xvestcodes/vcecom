import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserBundleSelection } from "../../bundles/services/bundle-eligibility.service";
import { EnrichedCartItemDto } from "./enriched-cart-item.dto";

export class BundleVariantBreakdownDto {
  @ApiProperty({
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  variantId: string;

  @ApiProperty({
    description: "Unit price for this variant",
    example: 999.99,
  })
  unitPrice: number;

  @ApiProperty({
    description: "Quantity of this variant in the bundle",
    example: 1,
  })
  quantity: number;
}

export class CartItemResponseDto {
  @ApiProperty({
    description: "Cart item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Item type: 'variant' or 'bundle'",
    example: "variant",
    enum: ["variant", "bundle"],
  })
  type: "variant" | "bundle";

  @ApiProperty({
    description:
      "Product variant ID (for variant items, or first variant for bundles)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  productVariantId: string;

  @ApiProperty({
    description: "Bundle ID (only for bundle items)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  bundleId?: string;

  @ApiProperty({
    description: "Bundle selections (only for bundle items)",
    example: {
      "set-1": ["variant-1"],
      "set-2": ["variant-2"],
    },
    required: false,
  })
  selections?: UserBundleSelection;

  @ApiProperty({
    description: "Quantity",
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: "Price at time of adding to cart (unit price for bundles)",
    example: 999.99,
  })
  price: number;

  @ApiProperty({
    description: "Unit bundle price (only for bundle items)",
    example: 1999.98,
    required: false,
  })
  unitBundlePrice?: number;

  @ApiProperty({
    description: "Bundle variant breakdown (only for bundle items)",
    type: [BundleVariantBreakdownDto],
    required: false,
  })
  bundleVariantBreakdown?: BundleVariantBreakdownDto[];

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  updatedAt: Date;
}

/**
 * Detailed discount information
 */
export class CartDiscountDto {
  @ApiProperty({
    description: "Discount code",
    example: "SAVE20",
  })
  code: string;

  @ApiProperty({
    description: "Discount type",
    enum: ["percentage", "fixed", "buy_x_get_y"],
    example: "percentage",
  })
  type: string;

  @ApiProperty({
    description: "Discount description",
    example: "20% off your entire order",
  })
  description: string;

  @ApiProperty({
    description: "Amount saved in INR",
    example: 200.0,
    type: Number,
  })
  amountSaved: number;

  @ApiProperty({
    description: "Percentage saved",
    example: 20,
    type: Number,
  })
  percentageSaved: number;

  @ApiProperty({
    description: "What the discount applies to",
    enum: ["cart", "shipping", "items"],
    example: "cart",
  })
  appliedTo: string;

  @ApiPropertyOptional({
    description: "Cart item IDs eligible for this discount",
    type: [String],
  })
  eligibleItems?: string[];
}

/**
 * Price summary with all calculations
 */
export class PriceSummaryDto {
  @ApiProperty({
    description: "Subtotal before discounts",
    example: 1999.98,
    type: Number,
  })
  subtotal: number;

  @ApiProperty({
    description: "Item-level discounts (sales, price lists)",
    example: 200.0,
    type: Number,
  })
  itemDiscounts: number;

  @ApiProperty({
    description: "Coupon discount",
    example: 180.0,
    type: Number,
  })
  couponDiscount: number;

  @ApiProperty({
    description: "Total before GST",
    example: 1619.98,
    type: Number,
  })
  totalBeforeGst: number;

  @ApiProperty({
    description: "GST amount",
    example: 291.6,
    type: Number,
  })
  gstAmount: number;

  @ApiProperty({
    description: "GST breakdown",
    type: Object,
    example: {
      cgst: 145.8,
      sgst: 145.8,
      igst: 0,
      totalGst: 291.6,
      isIntraState: true,
    },
  })
  gstBreakdown: {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    isIntraState: boolean;
  };

  @ApiProperty({
    description: "Final total",
    example: 1911.58,
    type: Number,
  })
  total: number;
}

export class CartResponseDto {
  @ApiProperty({
    description: "Cart ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Customer ID (null for guest carts)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  customerId: string | null;

  @ApiProperty({
    description: "Session ID (for guest carts)",
    example: "session_abc123",
    nullable: true,
  })
  sessionId: string | null;

  @ApiProperty({
    description: "Cart subtotal (before GST)",
    example: 1999.98,
  })
  subtotal: number;

  @ApiProperty({
    description: "GST amount",
    example: 359.99,
  })
  gstAmount: number;

  @ApiProperty({
    description: "Discount code applied",
    example: "SAVE20",
    nullable: true,
  })
  discountCode: string | null;

  @ApiProperty({
    description: "Discount amount",
    example: 200.0,
  })
  discountAmount: number;

  @ApiProperty({
    description: "GST breakdown details",
    example: {
      cgst: 180.0,
      sgst: 180.0,
      igst: 0,
      totalGst: 359.99,
      isIntraState: true,
    },
  })
  gstBreakdown: {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    isIntraState: boolean;
  };

  @ApiProperty({
    description: "Cart total (subtotal + GST)",
    example: 2359.97,
  })
  total: number;

  @ApiPropertyOptional({
    description:
      "Shipping cost from checkout session (only present when checkoutSessionId is provided)",
    example: 50.0,
    type: Number,
  })
  shippingCost?: number;

  @ApiPropertyOptional({
    description:
      "Payment method fee in paise from checkout session (only present when checkoutSessionId is provided)",
    example: 200,
    type: Number,
  })
  paymentFee?: number;

  @ApiProperty({
    description: "Cart items with enriched product data",
    type: [EnrichedCartItemDto],
  })
  items: EnrichedCartItemDto[];

  @ApiPropertyOptional({
    description: "Detailed discount information",
    type: CartDiscountDto,
  })
  discount?: CartDiscountDto;

  @ApiProperty({
    description: "Price summary with all calculations",
    type: PriceSummaryDto,
  })
  priceSummary: PriceSummaryDto;

  @ApiProperty({
    description: "Cart expiration timestamp",
    example: "2025-12-03T00:00:00.000Z",
    nullable: true,
  })
  expiresAt: Date | null;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  updatedAt: Date;
}
