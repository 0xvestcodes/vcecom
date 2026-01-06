import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export enum RegionPricingRuleType {
  OVERRIDE = "OVERRIDE",
  MARKUP = "MARKUP",
}

export enum RegionPricingOverrideType {
  FIXED = "FIXED",
  PERCENTAGE = "PERCENTAGE",
}

export class CreateRegionPricingRuleDto {
  @ApiProperty({
    description: "Rule name",
    example: "California Premium Pricing",
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: "Rule type",
    enum: RegionPricingRuleType,
    example: RegionPricingRuleType.MARKUP,
  })
  @IsEnum(RegionPricingRuleType)
  type: RegionPricingRuleType;

  @ApiProperty({
    description: "Array of country codes (ISO 3166-1 alpha-2)",
    example: ["US"],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiProperty({
    description: "Array of state codes/names",
    example: ["CA", "NY"],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states?: string[];

  @ApiProperty({
    description: "Product variant ID (optional, for variant-specific rule)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @ApiProperty({
    description: "Product ID (optional, for product-specific rule)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({
    description: "Category ID (optional, for category-specific rule)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({
    description: "Override type",
    enum: RegionPricingOverrideType,
    example: RegionPricingOverrideType.PERCENTAGE,
  })
  @IsEnum(RegionPricingOverrideType)
  overrideType: RegionPricingOverrideType;

  @ApiProperty({
    description: "Override value (price or percentage)",
    example: 10.5,
  })
  @IsNumber()
  overrideValue: number;

  @ApiProperty({
    description: "Priority (higher = higher priority)",
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiProperty({
    description: "Is rule active",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: "Start date (optional)",
    example: "2024-01-01T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  startDate?: Date;

  @ApiProperty({
    description: "End date (optional)",
    example: "2024-12-31T23:59:59.999Z",
    required: false,
  })
  @IsOptional()
  endDate?: Date;
}

export class UpdateRegionPricingRuleDto {
  @ApiProperty({
    description: "Rule name",
    example: "California Premium Pricing",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: "Rule type",
    enum: RegionPricingRuleType,
    example: RegionPricingRuleType.MARKUP,
    required: false,
  })
  @IsOptional()
  @IsEnum(RegionPricingRuleType)
  type?: RegionPricingRuleType;

  @ApiProperty({
    description: "Array of country codes (ISO 3166-1 alpha-2)",
    example: ["US"],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiProperty({
    description: "Array of state codes/names",
    example: ["CA", "NY"],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states?: string[];

  @ApiProperty({
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @ApiProperty({
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({
    description: "Category ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({
    description: "Override type",
    enum: RegionPricingOverrideType,
    example: RegionPricingOverrideType.PERCENTAGE,
    required: false,
  })
  @IsOptional()
  @IsEnum(RegionPricingOverrideType)
  overrideType?: RegionPricingOverrideType;

  @ApiProperty({
    description: "Override value (price or percentage)",
    example: 10.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  overrideValue?: number;

  @ApiProperty({
    description: "Priority (higher = higher priority)",
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiProperty({
    description: "Is rule active",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: "Start date",
    example: "2024-01-01T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  startDate?: Date;

  @ApiProperty({
    description: "End date",
    example: "2024-12-31T23:59:59.999Z",
    required: false,
  })
  @IsOptional()
  endDate?: Date;
}

export class RegionPricingRuleResponseDto {
  @ApiProperty({
    description: "Rule ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Rule name",
    example: "California Premium Pricing",
  })
  name: string;

  @ApiProperty({
    description: "Rule type",
    enum: RegionPricingRuleType,
    example: RegionPricingRuleType.MARKUP,
  })
  type: RegionPricingRuleType;

  @ApiProperty({
    description: "Array of country codes",
    example: ["US"],
    nullable: true,
  })
  countries: string[] | null;

  @ApiProperty({
    description: "Array of state codes/names",
    example: ["CA", "NY"],
    nullable: true,
  })
  states: string[] | null;

  @ApiProperty({
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  productVariantId: string | null;

  @ApiProperty({
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  productId: string | null;

  @ApiProperty({
    description: "Category ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  categoryId: string | null;

  @ApiProperty({
    description: "Override type",
    enum: RegionPricingOverrideType,
    example: RegionPricingOverrideType.PERCENTAGE,
  })
  overrideType: RegionPricingOverrideType;

  @ApiProperty({
    description: "Override value",
    example: 10.5,
  })
  overrideValue: number;

  @ApiProperty({
    description: "Priority",
    example: 0,
  })
  priority: number;

  @ApiProperty({
    description: "Is rule active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Start date",
    example: "2024-01-01T00:00:00.000Z",
    nullable: true,
  })
  startDate: Date | null;

  @ApiProperty({
    description: "End date",
    example: "2024-12-31T23:59:59.999Z",
    nullable: true,
  })
  endDate: Date | null;

  @ApiProperty({
    description: "Created at",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Updated at",
    example: "2024-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}
