import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateRefundDto {
  @ApiProperty({
    description: "Refund amount in INR",
    example: 500.0,
    minimum: 1,
  })
  @IsNumber({}, { message: "Amount must be a number" })
  @IsPositive({ message: "Amount must be greater than 0" })
  @IsNotEmpty({ message: "Amount is required" })
  amount: number;

  @ApiProperty({
    description: "Reason for refund",
    example: "Customer returned item",
    maxLength: 500,
  })
  @IsString({ message: "Reason must be a string" })
  @IsNotEmpty({ message: "Reason is required" })
  @MaxLength(500, { message: "Reason must not exceed 500 characters" })
  reason: string;

  @ApiProperty({
    description: "Refund to customer wallet instead of payment gateway",
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: "refundToWallet must be a boolean" })
  refundToWallet?: boolean;
}
