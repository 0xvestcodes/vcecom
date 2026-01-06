import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export enum TaxRuleType {
  CUSTOMER_GROUP = "CUSTOMER_GROUP",
  CUSTOMER = "CUSTOMER",
  CATEGORY = "CATEGORY",
  PRODUCT = "PRODUCT",
  VARIANT = "VARIANT",
}

export class CreateTaxRuleDto {
  @ApiProperty({
    description: "Tax rule name",
    example: "B2B Customer Group - 5% GST",
    maxLength: 255,
  })
  @IsNotEmpty({ message: "Name is required" })
  @IsString({ message: "Name must be a string" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name: string;

  @ApiProperty({
    description: "Tax rule description",
    example: "Special GST rate for B2B customer group",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  description?: string;

  @ApiProperty({
    description: "Tax rule type",
    enum: TaxRuleType,
    example: TaxRuleType.CUSTOMER_GROUP,
  })
  @IsNotEmpty({ message: "Rule type is required" })
  @IsEnum(TaxRuleType, { message: "Invalid rule type" })
  ruleType: TaxRuleType;

  @ApiProperty({
    description:
      "Entity ID (customer group, customer, category, product, or variant ID)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty({ message: "Entity ID is required" })
  @IsUUID(4, { message: "Entity ID must be a valid UUID" })
  entityId: string;

  @ApiProperty({
    description: "GST rate percentage (0-100)",
    example: 18,
  })
  @IsNotEmpty({ message: "GST rate is required" })
  @IsNumber({}, { message: "GST rate must be a number" })
  @Min(0, { message: "GST rate must be at least 0" })
  @Max(100, { message: "GST rate must be at most 100" })
  gstRate: number;

  @ApiProperty({
    description: "Priority (lower number = higher priority)",
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "Priority must be a number" })
  @Min(1, { message: "Priority must be at least 1" })
  priority?: number;

  @ApiProperty({
    description: "Whether tax rule is active",
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: "Start date (ISO 8601)",
    example: "2025-01-01T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "Start date must be a valid ISO 8601 date" })
  startDate?: string;

  @ApiProperty({
    description: "End date (ISO 8601)",
    example: "2025-12-31T23:59:59.999Z",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "End date must be a valid ISO 8601 date" })
  endDate?: string;
}

export class UpdateTaxRuleDto {
  @ApiProperty({
    description: "Tax rule name",
    example: "B2B Customer Group - 5% GST",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name?: string;

  @ApiProperty({
    description: "Tax rule description",
    example: "Special GST rate for B2B customer group",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  description?: string;

  @ApiProperty({
    description: "GST rate percentage (0-100)",
    example: 18,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "GST rate must be a number" })
  @Min(0, { message: "GST rate must be at least 0" })
  @Max(100, { message: "GST rate must be at most 100" })
  gstRate?: number;

  @ApiProperty({
    description: "Priority (lower number = higher priority)",
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "Priority must be a number" })
  @Min(1, { message: "Priority must be at least 1" })
  priority?: number;

  @ApiProperty({
    description: "Whether tax rule is active",
    example: true,
    required: false,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: "Start date (ISO 8601)",
    example: "2025-01-01T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "Start date must be a valid ISO 8601 date" })
  startDate?: string;

  @ApiProperty({
    description: "End date (ISO 8601)",
    example: "2025-12-31T23:59:59.999Z",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "End date must be a valid ISO 8601 date" })
  endDate?: string;
}

export class TaxRuleResponseDto {
  @ApiProperty({
    description: "Tax rule ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Tax rule name",
    example: "B2B Customer Group - 5% GST",
  })
  name: string;

  @ApiProperty({
    description: "Tax rule description",
    example: "Special GST rate for B2B customer group",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Tax rule type",
    enum: TaxRuleType,
    example: TaxRuleType.CUSTOMER_GROUP,
  })
  ruleType: TaxRuleType;

  @ApiProperty({
    description: "Entity ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  entityId: string;

  @ApiProperty({
    description: "GST rate percentage",
    example: 18,
  })
  gstRate: number;

  @ApiProperty({
    description: "Priority",
    example: 1,
  })
  priority: number;

  @ApiProperty({
    description: "Whether tax rule is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Start date",
    example: "2025-01-01T00:00:00.000Z",
    nullable: true,
  })
  startDate: Date | null;

  @ApiProperty({
    description: "End date",
    example: "2025-12-31T23:59:59.999Z",
    nullable: true,
  })
  endDate: Date | null;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}
