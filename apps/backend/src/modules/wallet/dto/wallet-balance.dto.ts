import { ApiProperty } from "@nestjs/swagger";

export class WalletBalanceResponseDto {
  @ApiProperty({ description: "Current wallet balance (store credits)" })
  walletBalance!: number;

  @ApiProperty({ description: "Current loyalty points balance" })
  loyaltyPoints!: number;

  @ApiProperty({ description: "Total credits earned lifetime" })
  totalEarned!: number;

  @ApiProperty({ description: "Total credits redeemed lifetime" })
  totalRedeemed!: number;

  @ApiProperty({ description: "Total points earned lifetime" })
  totalPointsEarned!: number;

  @ApiProperty({ description: "Total points redeemed lifetime" })
  totalPointsRedeemed!: number;
}
