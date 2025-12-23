import { ApiProperty } from "@nestjs/swagger";
import { OrderItemResponseDto } from "./order-item-response.dto";

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
    description: "Order items",
    type: [OrderItemResponseDto],
  })
  items: OrderItemResponseDto[];

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
