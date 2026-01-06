import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export enum TaxExemptionType {
  CUSTOMER_GROUP = "CUSTOMER_GROUP",
  CUSTOMER = "CUSTOMER",
  CATEGORY = "CATEGORY",
  PRODUCT = "PRODUCT",
  VARIANT = "VARIANT",
}

export class CreateTaxExemptionDto {
  @ApiProperty({
    description: "Tax exemption name",
    example: "Export Exemption - Customer Group",
    maxLength: 255,
  })
  @IsNotEmpty({ message: "Name is required" })
  @IsString({ message: "Name must be a string" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name: string;

  @ApiProperty({
    description: "Tax exemption description",
    example: "Tax exemption for export customers",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  description?: string;

  @ApiProperty({
    description: "Tax exemption type",
    enum: TaxExemptionType,
    example: TaxExemptionType.CUSTOMER_GROUP,
  })
  @IsNotEmpty({ message: "Exemption type is required" })
  @IsEnum(TaxExemptionType, { message: "Invalid exemption type" })
  exemptionType: TaxExemptionType;

  @ApiProperty({
    description:
      "Entity ID (customer group, customer, category, product, or variant ID)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty({ message: "Entity ID is required" })
  @IsUUID(4, { message: "Entity ID must be a valid UUID" })
  entityId: string;

  @ApiProperty({
    description: "Exemption reason",
    example: "Export",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Exemption reason must be a string" })
  exemptionReason?: string;

  @ApiProperty({
    description: "Certificate/document number",
    example: "CERT-12345",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Certificate number must be a string" })
  certificateNumber?: string;

  @ApiProperty({
    description: "Whether tax exemption is active",
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

export class UpdateTaxExemptionDto {
  @ApiProperty({
    description: "Tax exemption name",
    example: "Export Exemption - Customer Group",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name?: string;

  @ApiProperty({
    description: "Tax exemption description",
    example: "Tax exemption for export customers",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  description?: string;

  @ApiProperty({
    description: "Exemption reason",
    example: "Export",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Exemption reason must be a string" })
  exemptionReason?: string;

  @ApiProperty({
    description: "Certificate/document number",
    example: "CERT-12345",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Certificate number must be a string" })
  certificateNumber?: string;

  @ApiProperty({
    description: "Whether tax exemption is active",
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

export class TaxExemptionResponseDto {
  @ApiProperty({
    description: "Tax exemption ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Tax exemption name",
    example: "Export Exemption - Customer Group",
  })
  name: string;

  @ApiProperty({
    description: "Tax exemption description",
    example: "Tax exemption for export customers",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Tax exemption type",
    enum: TaxExemptionType,
    example: TaxExemptionType.CUSTOMER_GROUP,
  })
  exemptionType: TaxExemptionType;

  @ApiProperty({
    description: "Entity ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  entityId: string;

  @ApiProperty({
    description: "Exemption reason",
    example: "Export",
    nullable: true,
  })
  exemptionReason: string | null;

  @ApiProperty({
    description: "Certificate/document number",
    example: "CERT-12345",
    nullable: true,
  })
  certificateNumber: string | null;

  @ApiProperty({
    description: "Whether tax exemption is active",
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
