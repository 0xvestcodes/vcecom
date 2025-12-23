import { ApiProperty } from "@nestjs/swagger";

export class StartCheckoutResponseDto {
  @ApiProperty({
    description: "Checkout session ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  checkoutSessionId: string;

  @ApiProperty({
    description: "Cart ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  cartId: string;

  @ApiProperty({
    description: "Session expiration timestamp (ISO 8601)",
    example: "2025-12-27T02:44:36.770Z",
  })
  expiresAt: string;

  @ApiProperty({
    description: "Cart totals",
    example: {
      subtotal: 1999.98,
      discount: 200.0,
      total: 1799.98,
    },
  })
  totals: {
    subtotal: number;
    discount: number;
    total: number;
  };
}

export class ApplyAddressResponseDto {
  @ApiProperty({
    description: "Success flag",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Address ID (for authenticated users)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  addressId?: string;

  @ApiProperty({
    description: "Serviceability check result",
    example: {
      isValid: true,
      isServiceable: true,
      pincode: "110001",
    },
  })
  serviceability: {
    isValid: boolean;
    isServiceable: boolean;
    pincode: string;
  };

  @ApiProperty({
    description: "Auto-selected shipping method ID (if only one method available)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  autoSelectedShippingMethodId?: string;

  @ApiProperty({
    description: "Checkout session ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  checkoutSessionId: string;
}

export class SelectShippingResponseDto {
  @ApiProperty({
    description: "Success flag",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Shipping cost",
    example: 50.0,
  })
  shippingCost: number;

  @ApiProperty({
    description: "Estimated delivery days",
    example: 3,
    required: false,
  })
  estimatedDays?: number;

  @ApiProperty({
    description: "Whether COD is available for this shipping method",
    example: true,
    required: false,
  })
  codAvailable?: boolean;

  @ApiProperty({
    description: "Checkout session ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  checkoutSessionId: string;
}

export class ConfirmCheckoutResponseDto {
  @ApiProperty({
    description: "Order ID (null for online payments until payment confirmation)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  orderId: string | null;

  @ApiProperty({
    description: "Payment intent ID (for online payments)",
    example: "order_abc123",
    nullable: true,
  })
  paymentIntentId: string | null;

  @ApiProperty({
    description: "Payment redirect URL (for online payments)",
    example: "https://razorpay.com/checkout/order_abc123",
    nullable: true,
  })
  redirectUrl: string | null;

  @ApiProperty({
    description: "Checkout session ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  checkoutSessionId: string;
}

