import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreditWalletDto {
  @ApiProperty({ description: "Amount to credit" })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: "Description of the credit" })
  @IsString()
  description!: string;

  @ApiProperty({ required: false, description: "Related order ID" })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({ required: false, description: "Related refund ID" })
  @IsOptional()
  @IsString()
  refundId?: string;

  @ApiProperty({ required: false, description: "Additional metadata" })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class DebitWalletDto {
  @ApiProperty({ description: "Amount to debit" })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: "Description of the debit" })
  @IsString()
  description!: string;

  @ApiProperty({ required: false, description: "Related order ID" })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({ required: false, description: "Additional metadata" })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
