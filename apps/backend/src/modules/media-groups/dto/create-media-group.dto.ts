import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateMediaGroupDto {
  @ApiProperty({
    description: "Media group name",
    example: "banners",
    maxLength: 255,
  })
  @IsString({ message: "Name must be a string" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name: string;

  @ApiProperty({
    description: "Media group slug (auto-generated from name if not provided)",
    example: "banners",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Slug must be a string" })
  @MaxLength(255, { message: "Slug must not exceed 255 characters" })
  slug?: string;

  @ApiProperty({
    description: "Media group description",
    example: "Homepage banner images",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @MaxLength(5000, { message: "Description must not exceed 5000 characters" })
  description?: string;

  @ApiProperty({
    description: "Display order for sorting groups",
    example: 0,
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: "Display order must be an integer" })
  @Min(0, { message: "Display order must be at least 0" })
  displayOrder?: number = 0;

  @ApiProperty({
    description: "Whether the group is active",
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: "isActive must be a boolean" })
  isActive?: boolean = true;

  @ApiProperty({
    description: "Additional metadata",
    example: { category: "marketing", location: "homepage" },
    required: false,
  })
  @IsOptional()
  @IsObject({ message: "Metadata must be an object" })
  metadata?: Record<string, unknown>;
}
