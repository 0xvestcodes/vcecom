import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsUUID } from "class-validator";

export class ApplyWalletDto {
  @ApiProperty({
    description: "Checkout session ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  checkoutSessionId: string;

  @ApiProperty({
    description: "Use wallet balance for payment",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  useWallet?: boolean;

  @ApiProperty({
    description: "Points to redeem",
    example: 100,
    required: false,
  })
  @IsOptional()
  pointsToRedeem?: number;
}
