import { ApiProperty } from "@nestjs/swagger";

export class MediaItemResponseDto {
  @ApiProperty({
    description: "Media item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Media group ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  groupId: string;

  @ApiProperty({
    description: "Storage key/path",
    example: "media/banners/20251216-abc123.webp",
  })
  storageKey: string;

  @ApiProperty({
    description: "Public URL",
    example: "https://example.com/media/banners/20251216-abc123.webp",
  })
  url: string;

  @ApiProperty({
    description: "Alt text for accessibility",
    example: "Summer sale banner",
    nullable: true,
  })
  altText: string | null;

  @ApiProperty({
    description: "Image caption",
    example: "Summer Sale 2025",
    nullable: true,
  })
  caption: string | null;

  @ApiProperty({
    description: "Display order within the group",
    example: 0,
  })
  displayOrder: number;

  @ApiProperty({
    description: "Optional link URL when image is clicked",
    example: "/collections/summer-sale",
    nullable: true,
  })
  linkUrl: string | null;

  @ApiProperty({
    description: "Whether the item is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Additional metadata",
    example: { width: 1920, height: 1080, size: 245678 },
    nullable: true,
  })
  metadata: Record<string, unknown> | null;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  updatedAt: Date;
}
