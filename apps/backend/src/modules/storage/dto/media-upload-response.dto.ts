import { ApiProperty } from "@nestjs/swagger";
import { FileResponseDto } from "./file-response.dto";

export class MediaUploadResponseDto {
  @ApiProperty({
    description: "Original file information",
    type: FileResponseDto,
  })
  original: FileResponseDto;

  @ApiProperty({
    description: "Resized versions of the image",
    type: "object",
    properties: {
      thumbnail: { type: FileResponseDto },
      small: { type: FileResponseDto },
      medium: { type: FileResponseDto },
      large: { type: FileResponseDto },
    },
  })
  sizes: {
    thumbnail: FileResponseDto;
    small: FileResponseDto;
    medium: FileResponseDto;
    large: FileResponseDto;
  };

  @ApiProperty({
    description: "Multiple format versions (WebP and AVIF)",
    type: "object",
    properties: {
      webp: {
        type: "array",
        items: { $ref: "#/components/schemas/FileResponseDto" },
      },
      avif: {
        type: "array",
        items: { $ref: "#/components/schemas/FileResponseDto" },
      },
    },
  })
  formats: {
    webp: FileResponseDto[];
    avif: FileResponseDto[];
  };

  @ApiProperty({
    description: "Content hash for cache busting",
    example: "a1b2c3d4",
  })
  hash: string;
}
