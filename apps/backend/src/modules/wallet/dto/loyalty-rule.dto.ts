import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateLoyaltyRuleDto {
  @ApiProperty({ description: "Rule name" })
  @IsString()
  name!: string;

  @ApiProperty({
    enum: ["earning", "redemption"],
    description: "Rule type",
  })
  @IsEnum(["earning", "redemption"])
  type!: "earning" | "redemption";

  @ApiProperty({
    enum: ["percentage", "fixed", "tiered"],
    description: "Calculation type",
  })
  @IsEnum(["percentage", "fixed", "tiered"])
  ruleType!: "percentage" | "fixed" | "tiered";

  @ApiProperty({
    required: false,
    description: "Points per rupee (for earning rules)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerRupee?: number;

  @ApiProperty({
    required: false,
    description: "Rupees per point (for redemption rules)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rupeesPerPoint?: number;

  @ApiProperty({ required: false, description: "Minimum order value to earn" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiProperty({
    required: false,
    description: "Minimum points required to redeem",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPointsToRedeem?: number;

  @ApiProperty({
    required: false,
    description: "Max points redeemable per order",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxPointsPerOrder?: number;

  @ApiProperty({ required: false, description: "Valid from date" })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiProperty({ required: false, description: "Valid until date" })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({
    required: false,
    description: "Customer group ID (null for all)",
  })
  @IsOptional()
  @IsString()
  customerGroupId?: string;

  @ApiProperty({ required: false, description: "Additional metadata" })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateLoyaltyRuleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerRupee?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rupeesPerPoint?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPointsToRedeem?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxPointsPerOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerGroupId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class LoyaltyRuleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["earning", "redemption"] })
  type!: string;

  @ApiProperty({ enum: ["percentage", "fixed", "tiered"] })
  ruleType!: string;

  @ApiProperty()
  pointsPerRupee!: number;

  @ApiProperty()
  rupeesPerPoint!: number;

  @ApiProperty()
  minOrderValue!: number;

  @ApiProperty()
  minPointsToRedeem!: number;

  @ApiProperty({ required: false })
  maxPointsPerOrder?: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  validFrom!: Date;

  @ApiProperty({ required: false })
  validUntil?: Date;

  @ApiProperty({ required: false })
  customerGroupId?: string;

  @ApiProperty({ required: false })
  metadata?: Record<string, unknown>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
