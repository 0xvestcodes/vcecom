import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import sharp from "sharp";

export interface ImageSize {
  width: number;
  height: number;
  name: string;
}

export interface ResizeResult {
  thumbnail: Buffer; // 150x150
  small: Buffer; // 400x400
  medium: Buffer; // 800x800
  large: Buffer; // 1200x1200
  original: Buffer; // Original size
  metadata: {
    width: number;
    height: number;
    format: string;
  };
}

export const IMAGE_SIZES: ImageSize[] = [
  { width: 150, height: 150, name: "thumbnail" },
  { width: 400, height: 400, name: "small" },
  { width: 800, height: 800, name: "medium" },
  { width: 1200, height: 1200, name: "large" },
];

@Injectable()
export class ImageResizePipelineService {
  constructor(private readonly logger: PinoLogger) {}

  /**
   * Generate multiple sizes of an image
   * @param buffer - Original image buffer
   * @param format - Output format (webp, avif, jpeg, png)
   * @param quality - Image quality (0-100)
   * @returns ResizeResult with all sizes
   */
  async generateSizes(
    buffer: Buffer,
    format: "webp" | "avif" | "jpeg" | "png" = "webp",
    quality: number = 80,
  ): Promise<ResizeResult> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error("Unable to determine image dimensions");
      }

      const originalFormat = metadata.format || "jpeg";
      const originalBuffer = buffer;

      // Generate all sizes in parallel
      const [thumbnail, small, medium, large] = await Promise.all([
        this.resizeImage(image.clone(), 150, 150, format, quality),
        this.resizeImage(image.clone(), 400, 400, format, quality),
        this.resizeImage(image.clone(), 800, 800, format, quality),
        this.resizeImage(image.clone(), 1200, 1200, format, quality),
      ]);

      this.logger.debug(
        `Generated sizes: thumbnail=${thumbnail.length}, small=${small.length}, medium=${medium.length}, large=${large.length}`,
      );

      return {
        thumbnail,
        small,
        medium,
        large,
        original: originalBuffer,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: originalFormat,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate image sizes: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to generate image sizes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Resize an image to specific dimensions
   * @param image - Sharp image instance
   * @param maxWidth - Maximum width
   * @param maxHeight - Maximum height
   * @param format - Output format
   * @param quality - Image quality
   * @returns Resized image buffer
   */
  private async resizeImage(
    image: sharp.Sharp,
    maxWidth: number,
    maxHeight: number,
    format: "webp" | "avif" | "jpeg" | "png",
    quality: number,
  ): Promise<Buffer> {
    let pipeline = image.resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });

    // Apply format conversion
    switch (format) {
      case "webp":
        pipeline = pipeline.webp({ quality });
        break;
      case "avif":
        pipeline = pipeline.avif({ quality });
        break;
      case "jpeg":
        pipeline = pipeline.jpeg({ quality, progressive: true });
        break;
      case "png":
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
        break;
    }

    return pipeline.toBuffer();
  }

  /**
   * Get image size configuration by name
   */
  getSizeConfig(name: string): ImageSize | undefined {
    return IMAGE_SIZES.find((size) => size.name === name);
  }

  /**
   * Get all available image sizes
   */
  getAvailableSizes(): ImageSize[] {
    return IMAGE_SIZES;
  }
}
