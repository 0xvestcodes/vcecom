import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from "class-validator";

export class CreatePayUOrderDto {
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
    description: "Product information",
    example: "Order #ORD-2025-001234",
  })
  @IsNotEmpty({ message: "Product information is required" })
  productinfo: string;

  @ApiProperty({
    description: "Customer first name",
    example: "John",
  })
  @IsNotEmpty({ message: "First name is required" })
  firstname: string;

  @ApiProperty({
    description: "Customer email",
    example: "john@example.com",
  })
  @IsEmail({}, { message: "Email must be a valid email address" })
  @IsNotEmpty({ message: "Email is required" })
  email: string;

  @ApiProperty({
    description: "Customer phone number",
    example: "9876543210",
    required: false,
  })
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: "Customer last name",
    example: "Doe",
    required: false,
  })
  @IsOptional()
  lastname?: string;

  @ApiProperty({
    description: "Customer address",
    example: "123 Main Street",
    required: false,
  })
  @IsOptional()
  address1?: string;

  @ApiProperty({
    description: "Customer city",
    example: "Mumbai",
    required: false,
  })
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: "Customer state",
    example: "Maharashtra",
    required: false,
  })
  @IsOptional()
  state?: string;

  @ApiProperty({
    description: "Customer ZIP code",
    example: "400001",
    required: false,
  })
  @IsOptional()
  zipcode?: string;

  @ApiProperty({
    description: "Customer country",
    example: "India",
    required: false,
  })
  @IsOptional()
  country?: string;

  @ApiProperty({
    description: "Return URL after payment",
    example: "https://example.com/payment/return",
    required: false,
  })
  @IsOptional()
  surl?: string;

  @ApiProperty({
    description: "Cancel URL",
    example: "https://example.com/payment/cancel",
    required: false,
  })
  @IsOptional()
  furl?: string;

  @ApiProperty({
    description: "Additional user defined fields",
    example: { checkout_session_id: "session_123" },
    required: false,
  })
  @IsOptional()
  udf?: {
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
    udf6?: string;
    udf7?: string;
    udf8?: string;
    udf9?: string;
    udf10?: string;
  };
}

export class PayUOrderResponseDto {
  @ApiProperty({
    description: "PayU transaction ID",
    example: "txn_1234567890",
  })
  txnid: string;

  @ApiProperty({
    description: "Payment hash for form submission",
    example: "abc123def456...",
  })
  hash: string;

  @ApiProperty({
    description: "PayU payment URL",
    example: "https://test.payu.in/_payment",
  })
  paymentUrl: string;

  @ApiProperty({
    description: "Amount in paise",
    example: 100000,
  })
  amount: number;

  @ApiProperty({
    description: "Product information",
    example: "Order #ORD-2025-001234",
  })
  productinfo: string;

  @ApiProperty({
    description: "Customer first name",
    example: "John",
  })
  firstname: string;

  @ApiProperty({
    description: "Customer email",
    example: "john@example.com",
  })
  email: string;
}
