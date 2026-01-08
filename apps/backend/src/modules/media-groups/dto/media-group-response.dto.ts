import { ApiProperty } from "@nestjs/swagger";

export class MediaGroupResponseDto {
  @ApiProperty({
    description: "Media group ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Media group name",
    example: "banners",
  })
  name: string;

  @ApiProperty({
    description: "Media group slug",
    example: "banners",
  })
  slug: string;

  @ApiProperty({
    description: "Media group description",
    example: "Homepage banner images",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Display order for sorting",
    example: 0,
  })
  displayOrder: number;

  @ApiProperty({
    description: "Whether the group is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Additional metadata",
    example: { category: "marketing", location: "homepage" },
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

  @ApiProperty({
    description: "Number of active images in the group",
    example: 5,
    required: false,
  })
  imageCount?: number;
}
