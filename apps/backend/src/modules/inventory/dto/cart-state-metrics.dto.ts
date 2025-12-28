import { ApiProperty } from "@nestjs/swagger";

export class CartStateMetricsDto {
  @ApiProperty({
    description: "Count of cart items in 'fresh' state (active reservations)",
    example: 150,
  })
  fresh: number;

  @ApiProperty({
    description: "Count of cart items in 'stale' state (reservations expired)",
    example: 25,
  })
  stale: number;

  @ApiProperty({
    description: "Count of cart items in 'reacquired' state (checkout in progress)",
    example: 10,
  })
  reacquired: number;

  @ApiProperty({
    description: "Count of cart items in 'committed' state (order placed)",
    example: 500,
  })
  committed: number;

  @ApiProperty({
    description: "Total count of cart items across all states",
    example: 685,
  })
  total: number;

  @ApiProperty({
    description: "Percentage of stale items that were successfully reacquired during checkout",
    example: 75.5,
    required: false,
  })
  stale_recovery_rate?: number;
}

