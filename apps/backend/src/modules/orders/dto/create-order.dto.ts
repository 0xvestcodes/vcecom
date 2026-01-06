import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { CreateAddressDto } from "../../customers/dto/create-address.dto";

export class CreateOrderDto {
  // Authenticated user fields (required if not guest checkout)
  @ApiProperty({
    description: "Shipping address ID (required for authenticated users)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @ValidateIf((o) => !o.email && !o.checkoutSessionId)
  @IsUUID("4", { message: "Shipping address ID must be a valid UUID" })
  @IsNotEmpty({
    message: "Shipping address ID is required for authenticated users",
  })
  shippingAddressId?: string;

  @ApiProperty({
    description: "Billing address ID (required for authenticated users)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @ValidateIf((o) => !o.email && !o.checkoutSessionId)
  @IsUUID("4", { message: "Billing address ID must be a valid UUID" })
  @IsNotEmpty({
    message: "Billing address ID is required for authenticated users",
  })
  billingAddressId?: string;

  // Guest checkout fields (required if guest checkout)
  @ApiProperty({
    description: "Email address (required for guest checkout)",
    example: "customer@example.com",
    required: false,
  })
  @ValidateIf((o) => !o.shippingAddressId && !o.checkoutSessionId)
  @IsEmail({}, { message: "Email must be a valid email address" })
  @IsNotEmpty({ message: "Email is required for guest checkout" })
  email?: string;

  @ApiProperty({
    description: "Customer name (required for guest checkout)",
    example: "John Doe",
    required: false,
  })
  @ValidateIf((o) => !o.shippingAddressId && !o.checkoutSessionId)
  @IsString({ message: "Name must be a string" })
  @IsNotEmpty({ message: "Name is required for guest checkout" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name?: string;

  @ApiProperty({
    description: "Phone number (required for guest checkout)",
    example: "+919876543210",
    required: false,
  })
  @ValidateIf((o) => !o.shippingAddressId && !o.checkoutSessionId)
  @IsString({ message: "Phone must be a string" })
  @IsNotEmpty({ message: "Phone is required for guest checkout" })
  @MaxLength(20, { message: "Phone must not exceed 20 characters" })
  phone?: string;

  @ApiProperty({
    description: "Shipping address (required for guest checkout)",
    type: CreateAddressDto,
    required: false,
  })
  @ValidateIf((o) => !o.shippingAddressId && !o.checkoutSessionId)
  @IsNotEmpty({ message: "Shipping address is required for guest checkout" })
  address?: CreateAddressDto;

  @ApiProperty({
    description:
      "Password (optional - if provided, creates account instead of guest)",
    example: "SecurePassword123!",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Password must be a string" })
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  password?: string;

  // Common fields
  @ApiProperty({
    description: "Shipping cost in INR",
    example: 50.0,
    default: 0,
    required: false,
  })
  @IsOptional()
  shippingCost?: number;

  @ApiProperty({
    description: "Idempotency key for ensuring order creation is idempotent",
    example: "unique-request-id-12345",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Idempotency key must be a string" })
  idempotencyKey?: string;

  @ApiProperty({
    description:
      "Existing checkout session ID (optional - if provided, skips session creation and lock acquisition)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID("4", { message: "Checkout session ID must be a valid UUID" })
  checkoutSessionId?: string;

  @ApiProperty({
    description:
      "Payment method ID (optional - if provided, updates checkout metadata with selected payment method)",
    example: "COD",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Payment method ID must be a string" })
  paymentMethodId?: string;
}
