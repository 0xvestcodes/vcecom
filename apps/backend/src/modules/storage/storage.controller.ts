import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_LIST_KEYS,
  MAX_IMAGE_QUALITY,
  MAX_LIST_KEYS,
  MIN_IMAGE_QUALITY,
} from "../../common/constants";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import {
  BatchDeleteDto,
  BatchDeleteResponseDto,
  ListFilesDto,
  ListFilesResponseDto,
} from "./dto/batch-operations.dto";
import { FileMetadataDto, FileResponseDto } from "./dto/file-response.dto";
import { MediaUploadResponseDto } from "./dto/media-upload-response.dto";
import {
  GeneratePresignedUrlDto,
  PresignedUrlResponseDto,
} from "./dto/presigned-url.dto";
import { BatchUploadFileDto, UploadFileDto } from "./dto/upload-file.dto";
import { ImageCompressionService } from "./services/image-compression.service";
import { ImageResizePipelineService } from "./services/image-resize-pipeline.service";
import { MediaUrlService } from "./services/media-url.service";
import { StorageService } from "./storage.service";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

@ApiTags("admin")
@Controller("admin/storage")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly imageCompressionService: ImageCompressionService,
    private readonly imageResizePipelineService: ImageResizePipelineService,
    private readonly mediaUrlService: MediaUrlService,
  ) {}

  /**
   * Generate a unique file key
   */
  private generateFileKey(
    prefix: string | undefined,
    originalName: string,
    format: string,
    hash?: string,
  ): string {
    const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const uuid = randomUUID().split("-")[0];
    const extension = this.imageCompressionService.getFileExtension(
      format as "webp" | "avif" | "jpeg" | "png",
    );
    const sanitizedName = originalName
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .toLowerCase();
    const namePart = sanitizedName.split(".")[0] || "file";
    const hashPart = hash ? `-${hash}` : `-${uuid}`;
    const fileName = `${namePart}${hashPart}.${extension}`;
    return prefix
      ? `${prefix}/${timestamp}-${fileName}`
      : `${timestamp}-${fileName}`;
  }

  @Post("upload")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload a single file",
    description:
      "Upload a file to storage with automatic image compression. Maximum file size: 50MB. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 413,
    description: "File size exceeds maximum allowed size of 50MB",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "File to upload",
        },
        prefix: {
          type: "string",
          description: "File prefix/path in storage (e.g., 'products')",
          example: "products",
        },
        quality: {
          type: "number",
          description: `Image quality (${MIN_IMAGE_QUALITY}-${MAX_IMAGE_QUALITY}), default: ${DEFAULT_IMAGE_QUALITY}`,
          example: DEFAULT_IMAGE_QUALITY,
        },
        maxWidth: {
          type: "number",
          description: "Maximum width in pixels, default: 1280",
          example: 1280,
        },
        format: {
          type: "string",
          enum: ["webp", "jpeg", "png"],
          description: "Output format, default: webp",
          example: "webp",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded successfully",
    type: FileResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ): Promise<FileResponseDto> {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    // Validate file size (additional check before processing)
    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }

    let buffer = file.buffer;
    let contentType = file.mimetype;
    let format: "webp" | "avif" | "jpeg" | "png" = "webp";

    // Compress image if it's an image
    if (this.imageCompressionService.isImage(buffer, file.mimetype)) {
      format = dto.compressionOptions?.format || "webp";
      buffer = await this.imageCompressionService.compress(buffer, {
        quality: dto.compressionOptions?.quality,
        maxWidth: dto.compressionOptions?.maxWidth,
        maxHeight: dto.compressionOptions?.maxHeight,
        format,
      });
      contentType = this.imageCompressionService.getOptimizedMimeType(format);
    }

    // Generate file key
    const key = this.generateFileKey(dto.prefix, file.originalname, format);

    // Upload to storage
    const url = await this.storageService.upload(key, buffer, contentType);

    return {
      key,
      url,
      size: buffer.length,
      contentType,
      originalName: file.originalname,
    };
  }

  @Post("upload/batch")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor("files", 10, { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload multiple files",
    description:
      "Upload multiple files to storage with automatic image compression. Admin-only endpoint.",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "string",
            format: "binary",
          },
          description: "Files to upload (max 10)",
        },
        prefix: {
          type: "string",
          description: "File prefix/path in storage",
          example: "products",
        },
        quality: {
          type: "number",
          description: `Image quality (${MIN_IMAGE_QUALITY}-${MAX_IMAGE_QUALITY}), default: ${DEFAULT_IMAGE_QUALITY}`,
          example: DEFAULT_IMAGE_QUALITY,
        },
        maxWidth: {
          type: "number",
          description: "Maximum width in pixels, default: 1280",
          example: 1280,
        },
        format: {
          type: "string",
          enum: ["webp", "jpeg", "png"],
          description: "Output format, default: webp",
          example: "webp",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "Files uploaded successfully",
    type: [FileResponseDto],
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async uploadBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: BatchUploadFileDto,
  ): Promise<FileResponseDto[]> {
    if (!files || files.length === 0) {
      throw new Error("No files provided");
    }

    const results: FileResponseDto[] = [];

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        continue; // Skip invalid files
      }

      let buffer = file.buffer;
      let contentType = file.mimetype;
      let format: "webp" | "avif" | "jpeg" | "png" = "webp";

      // Compress image if it's an image
      if (this.imageCompressionService.isImage(buffer, file.mimetype)) {
        format = dto.compressionOptions?.format || "webp";
        buffer = await this.imageCompressionService.compress(buffer, {
          quality: dto.compressionOptions?.quality,
          maxWidth: dto.compressionOptions?.maxWidth,
          maxHeight: dto.compressionOptions?.maxHeight,
          format,
        });
        contentType = this.imageCompressionService.getOptimizedMimeType(format);
      }

      // Generate file key
      const key = this.generateFileKey(dto.prefix, file.originalname, format);

      // Upload to storage
      const url = await this.storageService.upload(key, buffer, contentType);

      results.push({
        key,
        url,
        size: buffer.length,
        contentType,
        originalName: file.originalname,
      });
    }

    return results;
  }

  @Post("upload/enhanced")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload file with enhanced pipeline",
    description:
      "Upload a file with automatic multi-size generation, WebP/AVIF format conversion, cache busting, and CDN optimization. Admin-only endpoint.",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "File to upload",
        },
        prefix: {
          type: "string",
          description: "File prefix/path in storage",
          example: "products",
        },
        bucketType: {
          type: "string",
          enum: ["product-media", "uploads", "internal"],
          description: "Bucket type for storage segmentation",
          example: "product-media",
        },
        quality: {
          type: "number",
          description: `Image quality (${MIN_IMAGE_QUALITY}-${MAX_IMAGE_QUALITY}), default: ${DEFAULT_IMAGE_QUALITY}`,
          example: DEFAULT_IMAGE_QUALITY,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded successfully with all sizes and formats",
    type: MediaUploadResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async uploadEnhanced(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    dto: UploadFileDto & {
      bucketType?: "product-media" | "uploads" | "internal";
    },
  ): Promise<MediaUploadResponseDto> {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }

    // Check if it's an image
    if (!this.imageCompressionService.isImage(file.buffer, file.mimetype)) {
      throw new BadRequestException("File must be an image");
    }

    const bucketType = dto.bucketType || "product-media";
    const quality = dto.compressionOptions?.quality || DEFAULT_IMAGE_QUALITY;

    // Generate content hash for cache busting
    const hash = this.mediaUrlService.generateHash(file.buffer);

    // Generate all sizes (WebP format)
    const resizeResult = await this.imageResizePipelineService.generateSizes(
      file.buffer,
      "webp",
      quality,
    );

    // Generate multiple formats for each size
    const formatPromises = [
      { name: "thumbnail", buffer: resizeResult.thumbnail },
      { name: "small", buffer: resizeResult.small },
      { name: "medium", buffer: resizeResult.medium },
      { name: "large", buffer: resizeResult.large },
    ].map(async ({ name, buffer }) => {
      const formats =
        await this.imageCompressionService.generateMultipleFormats(
          buffer,
          ["webp", "avif"],
          {
            quality,
            maxWidth: resizeResult.metadata.width,
            maxHeight: resizeResult.metadata.height,
          },
        );
      return { name, formats };
    });

    const sizeFormats = await Promise.all(formatPromises);

    // Prepare upload tasks
    const uploadTasks: Array<Promise<FileResponseDto>> = [];

    // Upload original
    const originalKey = this.generateFileKey(
      dto.prefix,
      file.originalname,
      "webp",
      hash,
    );
    uploadTasks.push(
      this.storageService
        .upload(
          originalKey,
          resizeResult.original,
          this.imageCompressionService.getOptimizedMimeType("webp"),
          bucketType,
          {
            CacheControl:
              this.mediaUrlService.getCacheControlHeader(bucketType),
            ETag: this.mediaUrlService.generateETag(resizeResult.original),
          },
        )
        .then((url) => ({
          key: originalKey,
          url,
          size: resizeResult.original.length,
          contentType:
            this.imageCompressionService.getOptimizedMimeType("webp"),
          originalName: file.originalname,
        })),
    );

    // Upload all sizes and formats
    for (const { name, formats } of sizeFormats) {
      for (const [format, buffer] of formats.entries()) {
        const key = this.generateFileKey(
          dto.prefix,
          `${name}-${file.originalname}`,
          format,
          hash,
        );
        uploadTasks.push(
          this.storageService
            .upload(
              key,
              buffer,
              this.imageCompressionService.getOptimizedMimeType(
                format as "webp" | "avif",
              ),
              bucketType,
              {
                CacheControl:
                  this.mediaUrlService.getCacheControlHeader(bucketType),
                ETag: this.mediaUrlService.generateETag(buffer),
              },
            )
            .then((url) => ({
              key,
              url: this.mediaUrlService.rewriteCdnUrl(url, { bucketType }),
              size: buffer.length,
              contentType: this.imageCompressionService.getOptimizedMimeType(
                format as "webp" | "avif",
              ),
              originalName: `${name}-${file.originalname}`,
            })),
        );
      }
    }

    // Upload all files in parallel
    const uploadResults = await Promise.all(uploadTasks);

    // Organize results
    const original = uploadResults[0];
    const thumbnail = uploadResults.find((r) => r.key.includes("thumbnail"));
    const small = uploadResults.find((r) => r.key.includes("small"));
    const medium = uploadResults.find((r) => r.key.includes("medium"));
    const large = uploadResults.find((r) => r.key.includes("large"));

    if (!thumbnail || !small || !medium || !large) {
      throw new Error("Required image sizes not found in upload results");
    }

    const sizes = {
      thumbnail,
      small,
      medium,
      large,
    };
    const formats = {
      webp: uploadResults.filter((r) => r.key.endsWith(".webp")),
      avif: uploadResults.filter((r) => r.key.endsWith(".avif")),
    };

    return {
      original,
      sizes,
      formats,
      hash,
    };
  }

  @Get("list")
  @ApiOperation({
    summary: "List files",
    description:
      "List files in storage with optional prefix filter. Admin-only endpoint.",
  })
  @ApiQuery({
    name: "prefix",
    required: false,
    type: String,
    description: "Prefix to filter files",
    example: "products",
  })
  @ApiQuery({
    name: "maxKeys",
    required: false,
    type: Number,
    description: `Maximum number of files to return (default: ${DEFAULT_LIST_KEYS}, max: ${MAX_LIST_KEYS})`,
    example: DEFAULT_LIST_KEYS,
  })
  @ApiResponse({
    status: 200,
    description: "List of files",
    type: ListFilesResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async listFiles(@Query() dto: ListFilesDto): Promise<ListFilesResponseDto> {
    const prefix = dto.prefix || "";
    const maxKeys = dto.maxKeys
      ? Math.min(dto.maxKeys, MAX_LIST_KEYS)
      : DEFAULT_LIST_KEYS;
    const fileKeys = await this.storageService.list(prefix, maxKeys);

    // Transform file keys into file metadata with URLs and size
    const files = await Promise.all(
      fileKeys.map(async (key) => {
        try {
          const [url, metadata] = await Promise.all([
            this.storageService.getUrl(key),
            this.storageService
              .getMetadata(key)
              .catch(() => ({ size: undefined, contentType: undefined })),
          ]);
          return {
            key,
            url,
            size: metadata.size,
            contentType: metadata.contentType,
          };
        } catch (_error) {
          // If metadata fetch fails, still return the file with URL
          const url = await this.storageService.getUrl(key);
          return {
            key,
            url,
          };
        }
      }),
    );

    return {
      files,
      total: files.length,
      prefix,
    };
  }

  @Get(":key")
  @ApiOperation({
    summary: "Get file URL/metadata",
    description: "Get public URL and metadata for a file. Admin-only endpoint.",
  })
  @ApiParam({
    name: "key",
    description: "File key/path in storage",
    example: "products/20251216-abc123-def456.webp",
  })
  @ApiResponse({
    status: 200,
    description: "File metadata",
    type: FileMetadataDto,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async getFile(@Param("key") key: string): Promise<FileMetadataDto> {
    const url = await this.storageService.getUrl(key);
    const exists = await this.storageService.exists(key);

    if (!exists) {
      throw new Error(`File not found: ${key}`);
    }

    return {
      key,
      url,
    };
  }

  @Delete("batch")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Batch delete files",
    description: "Delete multiple files from storage. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 200,
    description: "Batch delete result",
    type: BatchDeleteResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async batchDelete(
    @Body() dto: BatchDeleteDto,
  ): Promise<BatchDeleteResponseDto> {
    const failed: string[] = [];
    let deleted = 0;

    for (const key of dto.keys) {
      try {
        await this.storageService.delete(key);
        deleted++;
      } catch {
        failed.push(key);
      }
    }

    return {
      deleted,
      failed,
    };
  }

  @Delete(":key")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete a file",
    description: "Delete a file from storage by key. Admin-only endpoint.",
  })
  @ApiParam({
    name: "key",
    description: "File key/path in storage",
    example: "products/20251216-abc123-def456.webp",
  })
  @ApiResponse({
    status: 204,
    description: "File deleted successfully",
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async deleteFile(@Param("key") key: string): Promise<void> {
    await this.storageService.delete(key);
  }

  @Post("presigned-url")
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Generate presigned URL",
    description:
      "Generate a presigned URL for direct file upload. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 201,
    description: "Presigned URL generated",
    type: PresignedUrlResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async generatePresignedUrl(
    @Body() dto: GeneratePresignedUrlDto,
  ): Promise<PresignedUrlResponseDto> {
    const expiresIn = dto.expiresIn || 3600;
    const url = await this.storageService.getPresignedUrl(dto.key, expiresIn);

    return {
      key: dto.key,
      url,
      expiresIn,
    };
  }

  @Post("signed-download-url")
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Generate signed download URL",
    description:
      "Generate a signed URL for secure file download. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 201,
    description: "Signed download URL generated",
    type: PresignedUrlResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async generateSignedDownloadUrl(
    @Body()
    dto: GeneratePresignedUrlDto & {
      bucketType?: "product-media" | "uploads" | "internal";
    },
  ): Promise<PresignedUrlResponseDto> {
    const expiresIn = dto.expiresIn || 3600;
    const url = await this.storageService.getSignedDownloadUrl(
      dto.key,
      expiresIn,
      dto.bucketType,
    );

    return {
      key: dto.key,
      url,
      expiresIn,
    };
  }
}
