import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, Min } from "class-validator";

export class RedeemPointsDto {
  @ApiProperty({ description: "Points to redeem" })
  @IsNumber()
  @Min(1)
  points!: number;

  @ApiProperty({ description: "Order value for discount calculation" })
  @IsNumber()
  @Min(0)
  orderValue!: number;

  @ApiProperty({
    required: false,
    description: "Order ID (if redeeming during checkout)",
  })
  @IsOptional()
  orderId?: string;
}

export class RedeemPointsResponseDto {
  @ApiProperty({ description: "Points used" })
  pointsUsed!: number;

  @ApiProperty({ description: "Discount amount in rupees" })
  discountAmount!: number;
}
