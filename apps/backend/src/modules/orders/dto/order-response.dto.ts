import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { EnrichedOrderItemDto } from "./enriched-order-item.dto";
import { OrderItemResponseDto } from "./order-item-response.dto";

/**
 * Address DTO for order responses
 */
export class AddressDto {
  @ApiProperty({ description: "Address ID" })
  id: string;

  @ApiProperty({ description: "Full name", example: "John Doe" })
  fullName: string;

  @ApiProperty({ description: "Address line 1", example: "123 Main St" })
  addressLine1: string;

  @ApiPropertyOptional({
    description: "Address line 2",
    nullable: true,
  })
  addressLine2: string | null;

  @ApiProperty({ description: "City", example: "Mumbai" })
  city: string;

  @ApiProperty({ description: "State", example: "Maharashtra" })
  state: string;

  @ApiProperty({ description: "Postal code", example: "400001" })
  postalCode: string;

  @ApiProperty({ description: "Country", example: "India" })
  country: string;

  @ApiProperty({ description: "Phone", example: "+919876543210" })
  phone: string;
}

/**
 * Payment details DTO
 */
export class PaymentDetailsDto {
  @ApiProperty({ description: "Payment method", example: "razorpay" })
  method: string;

  @ApiProperty({
    description: "Payment status",
    enum: ["pending", "paid", "failed", "refunded"],
    example: "paid",
  })
  status: string;

  @ApiPropertyOptional({
    description: "Transaction ID",
    nullable: true,
  })
  transactionId: string | null;

  @ApiPropertyOptional({
    description: "Payment timestamp",
    nullable: true,
  })
  paidAt: Date | null;

  @ApiProperty({
    description: "Fee breakdown",
    type: Object,
  })
  feeBreakdown: {
    chargeType: string;
    amount: number;
    percentage?: number;
  };
}

/**
 * Shipping details DTO
 */
export class ShippingDetailsDto {
  @ApiPropertyOptional({
    description: "Shipping provider",
    nullable: true,
  })
  provider: string | null;

  @ApiPropertyOptional({
    description: "Shipping method",
    nullable: true,
  })
  method: string | null;

  @ApiPropertyOptional({
    description: "Tracking number",
    nullable: true,
  })
  trackingNumber: string | null;

  @ApiPropertyOptional({
    description: "Tracking URL",
    nullable: true,
  })
  trackingUrl: string | null;

  @ApiPropertyOptional({
    description: "Estimated delivery date",
    nullable: true,
  })
  estimatedDelivery: Date | null;

  @ApiPropertyOptional({
    description: "Shipped timestamp",
    nullable: true,
  })
  shippedAt: Date | null;

  @ApiPropertyOptional({
    description: "Delivered timestamp",
    nullable: true,
  })
  deliveredAt: Date | null;
}

export class OrderResponseDto {
  @ApiProperty({
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Customer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  customerId: string;

  @ApiProperty({
    description: "Unique order number",
    example: "ORD-2025-001234",
  })
  orderNumber: string;

  @ApiProperty({
    description: "Order status",
    example: "pending",
    enum: [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ],
  })
  status:
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded";

  @ApiProperty({
    description: "Order subtotal (before GST and shipping)",
    example: 1999.98,
  })
  subtotal: number;

  @ApiProperty({
    description: "Total GST amount",
    example: 359.99,
  })
  gstAmount: number;

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
    description: "Shipping cost",
    example: 50.0,
  })
  shippingCost: number;

  @ApiProperty({
    description: "Payment fee in paise (immutable after order creation)",
    example: 3000,
    required: false,
  })
  paymentFee?: number;

  @ApiProperty({
    description: "Payment method used",
    example: "COD",
    nullable: true,
  })
  paymentMethod?: string | null;

  @ApiProperty({
    description: "Payment fee breakdown details",
    example: {
      method: "COD",
      chargeType: "FLAT",
      flatAmount: 3000,
      calculatedFee: 3000,
    },
    nullable: true,
    required: false,
  })
  paymentFeeBreakdown?: {
    method: string;
    chargeType: string;
    calculatedFee: number;
    flatAmount?: number;
    percentage?: number;
    mixMin?: number;
    mixCap?: number;
  } | null;

  @ApiProperty({
    description: "Order total (subtotal + GST + shipping + payment fee)",
    example: 2409.97,
  })
  total: number;

  @ApiProperty({
    description: "Razorpay order ID (if payment initiated)",
    example: "order_abc123",
    nullable: true,
  })
  razorpayOrderId: string | null;

  @ApiProperty({
    description: "Shipping provider",
    example: "shiprocket",
    nullable: true,
  })
  shippingProvider: string | null;

  @ApiProperty({
    description: "Shipping address ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  shippingAddressId: string;

  @ApiProperty({
    description: "Billing address ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  billingAddressId: string;

  @ApiProperty({
    description: "Order items with enriched product data",
    type: [EnrichedOrderItemDto],
  })
  items: EnrichedOrderItemDto[] | OrderItemResponseDto[];

  @ApiPropertyOptional({
    description: "Complete shipping address details",
    type: AddressDto,
  })
  shippingAddress?: AddressDto;

  @ApiPropertyOptional({
    description: "Complete billing address details",
    type: AddressDto,
  })
  billingAddress?: AddressDto;

  @ApiPropertyOptional({
    description: "Payment details",
    type: PaymentDetailsDto,
  })
  paymentDetails?: PaymentDetailsDto;

  @ApiPropertyOptional({
    description: "Shipping details",
    type: ShippingDetailsDto,
  })
  shippingDetails?: ShippingDetailsDto;

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

  @ApiProperty({
    description: "Whether the order is archived",
    example: false,
    required: false,
  })
  archived?: boolean;

  @ApiProperty({
    description: "Timestamp when order was archived",
    example: "2025-11-26T00:00:00.000Z",
    nullable: true,
    required: false,
  })
  archivedAt?: Date | null;

  @ApiProperty({
    description: "User ID who archived the order",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
    required: false,
  })
  archivedBy?: string | null;

  @ApiProperty({
    description: "Discount code applied to the order",
    example: "SAVE20",
    nullable: true,
    required: false,
  })
  discountCode?: string | null;

  @ApiProperty({
    description: "Discount amount applied (INR)",
    example: 200.0,
    required: false,
  })
  discountAmount?: number;
}
