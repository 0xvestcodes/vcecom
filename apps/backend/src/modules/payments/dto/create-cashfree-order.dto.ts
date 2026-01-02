import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class CreateCashfreeOrderDto {
  @ApiProperty({
    description: "Order ID from the system",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID("4", { message: "Order ID must be a valid UUID" })
  @IsNotEmpty({ message: "Order ID is required" })
  orderId: string;

  @ApiProperty({
    description: "Amount in paise (e.g., 100000 for ₹1000)",
    example: 100000,
  })
  @IsNumber({}, { message: "Amount must be a number" })
  @Min(1, { message: "Amount must be at least 1 paise" })
  @IsNotEmpty({ message: "Amount is required" })
  amount: number;

  @ApiProperty({
    description: "Currency code (default: INR)",
    example: "INR",
    default: "INR",
    required: false,
  })
  @IsOptional()
  currency?: string;

  @ApiProperty({
    description: "Customer details",
    example: {
      customerId: "customer_123",
      customerName: "John Doe",
      customerEmail: "john@example.com",
      customerPhone: "9876543210",
    },
    required: false,
  })
  @IsOptional()
  customer?: {
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
  };

  @ApiProperty({
    description: "Return URL after payment",
    example: "https://example.com/payment/return",
    required: false,
  })
  @IsOptional()
  returnUrl?: string;

  @ApiProperty({
    description: "Notes for the order",
    example: { order_number: "ORD-2025-001234" },
    required: false,
  })
  @IsOptional()
  notes?: Record<string, string>;
}

export class CashfreeOrderResponseDto {
  @ApiProperty({
    description: "Cashfree order ID",
    example: "order_1234567890abcdef",
  })
  orderId: string;

  @ApiProperty({
    description: "Payment session ID",
    example: "session_1234567890abcdef",
  })
  paymentSessionId: string;

  @ApiProperty({
    description: "Order token",
    example: "token_1234567890abcdef",
  })
  orderToken: string;

  @ApiProperty({
    description: "Amount in paise",
    example: 100000,
  })
  orderAmount: number;

  @ApiProperty({
    description: "Currency code",
    example: "INR",
  })
  orderCurrency: string;

  @ApiProperty({
    description: "Order status",
    example: "ACTIVE",
  })
  orderStatus: string;

  @ApiProperty({
    description: "Payment URL for redirect",
    example: "https://payments.cashfree.com/order/#/orderToken",
  })
  paymentLink?: string;
}
