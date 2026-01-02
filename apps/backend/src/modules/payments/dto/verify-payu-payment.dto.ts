import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class VerifyPayUPaymentDto {
  @ApiProperty({
    description: "PayU transaction ID",
    example: "txn_1234567890",
  })
  @IsString({ message: "Transaction ID must be a string" })
  @IsNotEmpty({ message: "Transaction ID is required" })
  txnid: string;

  @ApiProperty({
    description: "Payment status",
    example: "success",
  })
  @IsString({ message: "Status must be a string" })
  @IsNotEmpty({ message: "Status is required" })
  status: string;

  @ApiProperty({
    description: "PayU payment hash for verification",
    example: "abc123def456...",
  })
  @IsString({ message: "Hash must be a string" })
  @IsNotEmpty({ message: "Hash is required" })
  hash: string;

  @ApiProperty({
    description: "Amount paid",
    example: 100000,
  })
  @IsNotEmpty({ message: "Amount is required" })
  amount: number;

  @ApiProperty({
    description: "Product information",
    example: "Order #ORD-2025-001234",
  })
  @IsString({ message: "Product info must be a string" })
  @IsNotEmpty({ message: "Product info is required" })
  productinfo: string;

  @ApiProperty({
    description: "Customer first name",
    example: "John",
  })
  @IsString({ message: "First name must be a string" })
  @IsNotEmpty({ message: "First name is required" })
  firstname: string;

  @ApiProperty({
    description: "Customer email",
    example: "john@example.com",
  })
  @IsString({ message: "Email must be a string" })
  @IsNotEmpty({ message: "Email is required" })
  email: string;

  @ApiProperty({
    description: "PayU payment ID",
    example: "payu_1234567890",
    required: false,
  })
  @IsOptional()
  payuMoneyId?: string;

  @ApiProperty({
    description: "Additional user defined fields",
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

export class PayUPaymentVerificationResponseDto {
  @ApiProperty({
    description: "Verification status",
    example: true,
  })
  verified: boolean;

  @ApiProperty({
    description: "Message",
    example: "Payment verified successfully",
  })
  message: string;

  @ApiProperty({
    description: "Payment details",
    nullable: true,
  })
  payment?: {
    id: string;
    orderId: string;
    amount: number;
    status: string;
    method: string;
  };
}
