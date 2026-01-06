import { ApiProperty } from "@nestjs/swagger";

export class CompressionOptionsDto {
  @ApiProperty({
    description: "Image quality (0-100), default: 60",
    example: 60,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  quality?: number;

  @ApiProperty({
    description: "Maximum width in pixels, default: 1280",
    example: 1280,
    minimum: 1,
    required: false,
  })
  maxWidth?: number;

  @ApiProperty({
    description:
      "Maximum height in pixels (maintains aspect ratio if not specified)",
    example: 1280,
    minimum: 1,
    required: false,
  })
  maxHeight?: number;

  @ApiProperty({
    description: "Output format (webp, avif, jpeg, png), default: webp",
    example: "webp",
    enum: ["webp", "avif", "jpeg", "png"],
    required: false,
  })
  format?: "webp" | "avif" | "jpeg" | "png";
}

export const DEFAULT_COMPRESSION_OPTIONS: Required<CompressionOptionsDto> = {
  quality: 60,
  maxWidth: 1280,
  maxHeight: 1280,
  format: "webp",
};
