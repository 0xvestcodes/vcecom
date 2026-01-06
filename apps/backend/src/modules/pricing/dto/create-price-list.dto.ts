import { ApiProperty } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export enum PriceListType {
  B2C = "B2C",
  B2B = "B2B",
  WHOLESALE = "WHOLESALE",
  RETAIL = "RETAIL",
  CUSTOM = "CUSTOM",
}

export enum PriceListOverrideType {
  FIXED = "FIXED",
  PERCENTAGE = "PERCENTAGE",
}

export class CreatePriceListDto {
  @ApiProperty({
    description: "Price list name",
    example: "B2B Corporate Pricing",
    maxLength: 255,
  })
  @IsNotEmpty({ message: "Name is required" })
  @IsString({ message: "Name must be a string" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name: string;

  @ApiProperty({
    description: "Price list description",
    example: "Special pricing for corporate customers",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  description?: string;

  @ApiProperty({
    description: "Price list type",
    example: PriceListType.B2B,
    enum: PriceListType,
    default: PriceListType.CUSTOM,
  })
  @IsOptional()
  @IsEnum(PriceListType, { message: "Type must be a valid price list type" })
  type?: PriceListType;

  @ApiProperty({
    description: "Priority (higher number = higher priority)",
    example: 10,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: "Priority must be an integer" })
  @Min(1, { message: "Priority must be at least 1" })
  priority?: number;

  @ApiProperty({
    description: "Whether price list is active",
    example: true,
    default: true,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: "Start date (ISO timestamp)",
    example: "2025-01-01T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  startDate?: Date;

  @ApiProperty({
    description: "End date (ISO timestamp)",
    example: "2025-12-31T23:59:59.999Z",
    required: false,
  })
  @IsOptional()
  endDate?: Date;

  @ApiProperty({
    description: "Currency code (null = applies to all currencies)",
    example: "USD",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Currency must be a string" })
  currency?: string | null;
}

export class CreatePriceListItemDto {
  @ApiProperty({
    description: "Price list ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty({ message: "Price list ID is required" })
  @IsString({ message: "Price list ID must be a string" })
  priceListId: string;

  @ApiProperty({
    description: "Product variant ID (for variant-specific override)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Product variant ID must be a string" })
  productVariantId?: string;

  @ApiProperty({
    description: "Product ID (for product-level override)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Product ID must be a string" })
  productId?: string;

  @ApiProperty({
    description: "Category ID (for category-level override)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Category ID must be a string" })
  categoryId?: string;

  @ApiProperty({
    description: "Override type (FIXED or PERCENTAGE)",
    example: PriceListOverrideType.PERCENTAGE,
    enum: PriceListOverrideType,
  })
  @IsNotEmpty({ message: "Override type is required" })
  @IsEnum(PriceListOverrideType, {
    message: "Override type must be FIXED or PERCENTAGE",
  })
  overrideType: PriceListOverrideType;

  @ApiProperty({
    description:
      "Override value (amount in INR for FIXED, percentage 0-100 for PERCENTAGE)",
    example: 10,
    minimum: 0,
  })
  @IsNotEmpty({ message: "Override value is required" })
  @IsNumber({}, { message: "Override value must be a number" })
  @Min(0, { message: "Override value must be greater than or equal to 0" })
  overrideValue: number;

  @ApiProperty({
    description:
      "Currency code (null = applies to all currencies for this price list)",
    example: "USD",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Currency must be a string" })
  currency?: string | null;
}
