import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsObject, IsOptional } from "class-validator";

export enum ImportType {
  PRODUCTS = "products",
  CATEGORIES = "categories",
  INVENTORY = "inventory",
  CUSTOMERS = "customers",
}

export enum ImportSource {
  CSV = "csv",
  EXCEL = "excel",
  JSON = "json",
  SHOPIFY = "shopify",
  API = "api",
}

export enum ImportJobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export class ImportOptionsDto {
  @ApiProperty({
    description: "Skip errors and continue processing",
    example: false,
    required: false,
  })
  @IsOptional()
  skipErrors?: boolean;

  @ApiProperty({
    description: "Update existing records instead of failing",
    example: false,
    required: false,
  })
  @IsOptional()
  updateExisting?: boolean;

  @ApiProperty({
    description: "Dry run mode - validate without importing",
    example: false,
    required: false,
  })
  @IsOptional()
  dryRun?: boolean;
}

export class CreateImportJobDto {
  @ApiProperty({
    description: "Import type",
    enum: ImportType,
    example: ImportType.PRODUCTS,
  })
  @IsNotEmpty()
  @IsEnum(ImportType)
  type: ImportType;

  @ApiProperty({
    description: "Import source",
    enum: ImportSource,
    example: ImportSource.CSV,
  })
  @IsNotEmpty()
  @IsEnum(ImportSource)
  source: ImportSource;

  @ApiProperty({
    description: "File to import (multipart/form-data)",
    type: "string",
    format: "binary",
    required: false,
  })
  @IsOptional()
  file?: Express.Multer.File;

  @ApiProperty({
    description: "Import options",
    type: ImportOptionsDto,
    required: false,
  })
  @IsOptional()
  @IsObject()
  options?: ImportOptionsDto;
}

export class ImportJobResponseDto {
  @ApiProperty({
    description: "Import job ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Import type",
    enum: ImportType,
  })
  type: ImportType;

  @ApiProperty({
    description: "Import source",
    enum: ImportSource,
  })
  source: ImportSource;

  @ApiProperty({
    description: "Job status",
    enum: ImportJobStatus,
  })
  status: ImportJobStatus;

  @ApiProperty({
    description: "File URL",
    required: false,
  })
  fileUrl?: string;

  @ApiProperty({
    description: "Total rows",
    example: 100,
  })
  totalRows: number;

  @ApiProperty({
    description: "Processed rows",
    example: 50,
  })
  processedRows: number;

  @ApiProperty({
    description: "Successful rows",
    example: 45,
  })
  successfulRows: number;

  @ApiProperty({
    description: "Failed rows",
    example: 5,
  })
  failedRows: number;

  @ApiProperty({
    description: "Created at",
  })
  createdAt: Date;
}

export class ImportJobStatusResponseDto extends ImportJobResponseDto {
  @ApiProperty({
    description: "Error count",
    example: 5,
  })
  errorCount: number;

  @ApiProperty({
    description: "Updated at",
  })
  updatedAt: Date;

  @ApiProperty({
    description: "Completed at",
    required: false,
  })
  completedAt?: Date;
}

export class ImportJobErrorResponseDto {
  @ApiProperty({
    description: "Error ID",
  })
  id: string;

  @ApiProperty({
    description: "Row number",
    example: 5,
  })
  rowNumber: number;

  @ApiProperty({
    description: "Field name",
    required: false,
  })
  field: string | null;

  @ApiProperty({
    description: "Invalid value",
    required: false,
  })
  value: string | null;

  @ApiProperty({
    description: "Error code",
    example: "REQUIRED_FIELD_MISSING",
  })
  errorCode: string;

  @ApiProperty({
    description: "Error message",
    example: "Title is required",
  })
  errorMessage: string;

  @ApiProperty({
    description: "Raw row data",
  })
  rawData: unknown;

  @ApiProperty({
    description: "Created at",
  })
  createdAt: Date;
}
