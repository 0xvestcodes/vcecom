import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class VerifyCashfreePaymentDto {
  @ApiProperty({
    description: "Cashfree order ID",
    example: "order_1234567890abcdef",
  })
  @IsString({ message: "Cashfree order ID must be a string" })
  @IsNotEmpty({ message: "Cashfree order ID is required" })
  orderId: string;

  @ApiProperty({
    description: "Cashfree payment ID",
    example: "pay_1234567890abcdef",
  })
  @IsString({ message: "Cashfree payment ID must be a string" })
  @IsNotEmpty({ message: "Cashfree payment ID is required" })
  paymentId: string;

  @ApiProperty({
    description: "Cashfree signature for verification",
    example: "abc123def456...",
  })
  @IsString({ message: "Cashfree signature must be a string" })
  @IsNotEmpty({ message: "Cashfree signature is required" })
  signature: string;
}

export class CashfreePaymentVerificationResponseDto {
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
