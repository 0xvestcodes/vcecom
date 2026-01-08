import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class CreateMediaItemDto {
  @ApiProperty({
    description: "Media group ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID(4, { message: "Group ID must be a valid UUID" })
  groupId: string;

  @ApiProperty({
    description: "Storage key/path from storage upload",
    example: "media/banners/20251216-abc123.webp",
  })
  @IsString({ message: "Storage key must be a string" })
  storageKey: string;

  @ApiProperty({
    description: "Public URL from storage upload",
    example: "https://example.com/media/banners/20251216-abc123.webp",
  })
  @IsString({ message: "URL must be a string" })
  url: string;

  @ApiProperty({
    description: "Alt text for accessibility",
    example: "Summer sale banner",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Alt text must be a string" })
  @MaxLength(500, { message: "Alt text must not exceed 500 characters" })
  altText?: string;

  @ApiProperty({
    description: "Image caption",
    example: "Summer Sale 2025",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Caption must be a string" })
  @MaxLength(1000, { message: "Caption must not exceed 1000 characters" })
  caption?: string;

  @ApiProperty({
    description: "Display order within the group",
    example: 0,
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: "Display order must be an integer" })
  @Min(0, { message: "Display order must be at least 0" })
  displayOrder?: number = 0;

  @ApiProperty({
    description: "Optional link URL when image is clicked",
    example: "/collections/summer-sale",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Link URL must be a string" })
  @MaxLength(500, { message: "Link URL must not exceed 500 characters" })
  linkUrl?: string;

  @ApiProperty({
    description: "Whether the item is active",
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: "isActive must be a boolean" })
  isActive?: boolean = true;

  @ApiProperty({
    description: "Additional metadata (size, dimensions, etc.)",
    example: { width: 1920, height: 1080, size: 245678 },
    required: false,
  })
  @IsOptional()
  @IsObject({ message: "Metadata must be an object" })
  metadata?: Record<string, unknown>;
}
