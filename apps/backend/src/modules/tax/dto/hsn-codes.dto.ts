import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateHsnCodeDto {
  @ApiProperty({
    description: "HSN code (8-digit numeric)",
    example: "12345678",
    maxLength: 8,
  })
  @IsNotEmpty({ message: "HSN code is required" })
  @IsString({ message: "HSN code must be a string" })
  @MaxLength(8, { message: "HSN code must be 8 digits" })
  hsnCode: string;

  @ApiProperty({
    description: "HSN code description",
    example: "Electronic goods",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  description?: string;

  @ApiProperty({
    description: "Default GST rate percentage (0-100)",
    example: 18,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "GST rate must be a number" })
  @Min(0, { message: "GST rate must be at least 0" })
  @Max(100, { message: "GST rate must be at most 100" })
  gstRate?: number;
}

export class UpdateHsnCodeDto {
  @ApiProperty({
    description: "HSN code description",
    example: "Electronic goods",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  description?: string;

  @ApiProperty({
    description: "Default GST rate percentage (0-100)",
    example: 18,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "GST rate must be a number" })
  @Min(0, { message: "GST rate must be at least 0" })
  @Max(100, { message: "GST rate must be at most 100" })
  gstRate?: number;

  @ApiProperty({
    description: "Whether HSN code is active",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: "isActive must be a boolean" })
  isActive?: boolean;
}

export class HsnCodeResponseDto {
  @ApiProperty({
    description: "HSN code ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "HSN code (8-digit numeric)",
    example: "12345678",
  })
  hsnCode: string;

  @ApiProperty({
    description: "HSN code description",
    example: "Electronic goods",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Default GST rate percentage",
    example: 18,
    nullable: true,
  })
  gstRate: number | null;

  @ApiProperty({
    description: "Whether HSN code is active",
    example: true,
  })
  isActive: boolean;

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
