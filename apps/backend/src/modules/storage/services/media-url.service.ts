import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../../common/config/app.config.service";

export interface MediaUrlOptions {
  hash?: string;
  cdnUrl?: string;
  bucketType?: "product-media" | "uploads" | "internal";
}

@Injectable()
export class MediaUrlService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly appConfigService: AppConfigService,
  ) {}

  /**
   * Generate content hash for cache busting
   * @param buffer - File buffer
   * @returns SHA-256 hash (first 8 characters)
   */
  generateHash(buffer: Buffer): string {
    const hash = createHash("sha256").update(buffer).digest("hex");
    // Use first 8 characters for shorter URLs
    return hash.substring(0, 8);
  }

  /**
   * Generate filename with hash for cache busting
   * @param originalName - Original filename
   * @param hash - Content hash
   * @param format - File format extension
   * @returns Filename with hash: image-{hash}.webp
   */
  generateHashedFilename(
    originalName: string,
    hash: string,
    format: string,
  ): string {
    // Extract base name without extension
    const baseName = originalName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .toLowerCase();

    // Generate new filename with hash
    return `${baseName}-${hash}.${format}`;
  }

  /**
   * Rewrite URL with CDN if configured
   * @param url - Original storage URL
   * @param options - URL options
   * @returns CDN URL or original URL
   */
  rewriteCdnUrl(url: string, options: MediaUrlOptions = {}): string {
    const cdnUrl = options.cdnUrl || this.appConfigService.getCdnUrl();

    if (!cdnUrl) {
      return url;
    }

    try {
      // Extract path from original URL
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // Construct CDN URL
      const cdnBase = cdnUrl.endsWith("/") ? cdnUrl.slice(0, -1) : cdnUrl;
      return `${cdnBase}${path}`;
    } catch (error) {
      this.logger.warn(
        `Failed to rewrite CDN URL: ${error instanceof Error ? error.message : String(error)}`,
      );
      return url;
    }
  }

  /**
   * Get cache control header based on bucket type
   * @param bucketType - Bucket type
   * @returns Cache-Control header value
   */
  getCacheControlHeader(
    bucketType?: "product-media" | "uploads" | "internal",
  ): string {
    switch (bucketType) {
      case "product-media":
        // Product media: long cache, immutable (hash-based cache busting)
        return "public, max-age=31536000, immutable";
      case "uploads":
        // User uploads: shorter cache
        return "public, max-age=86400";
      case "internal":
        // Internal files: private, short cache
        return "private, max-age=3600";
      default:
        // Default: public, long cache
        return "public, max-age=31536000, immutable";
    }
  }

  /**
   * Generate ETag from buffer
   * @param buffer - File buffer
   * @returns ETag value (weak ETag with W/ prefix)
   */
  generateETag(buffer: Buffer): string {
    const hash = createHash("md5").update(buffer).digest("hex");
    // Use weak ETag (W/) for better cache behavior
    return `W/"${hash}"`;
  }

  /**
   * Extract hash from filename
   * @param filename - Filename with hash
   * @returns Hash if found, undefined otherwise
   */
  extractHashFromFilename(filename: string): string | undefined {
    // Match pattern: name-{hash}.ext
    const match = filename.match(/-([a-f0-9]{8})\./);
    return match ? match[1] : undefined;
  }
}
