import { ApiProperty } from "@nestjs/swagger";

export class WalletTransactionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty({
    enum: [
      "credit",
      "debit",
      "points_earned",
      "points_redeemed",
      "refund",
      "admin_adjustment",
      "promotion",
    ],
  })
  type!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  points!: number;

  @ApiProperty()
  balanceAfter!: number;

  @ApiProperty()
  pointsAfter!: number;

  @ApiProperty({ required: false })
  orderId?: string;

  @ApiProperty({ required: false })
  refundId?: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ required: false })
  metadata?: Record<string, unknown>;

  @ApiProperty()
  createdAt!: Date;
}

export class WalletTransactionHistoryResponseDto {
  @ApiProperty({ type: [WalletTransactionDto] })
  transactions!: WalletTransactionDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}
