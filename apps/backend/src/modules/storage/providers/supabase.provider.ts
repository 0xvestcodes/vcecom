import "dotenv/config";
import { Injectable } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../../common/config/app.config.service";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { StorageProvider } from "../interfaces/storage-provider.interface";

@Injectable()
export class SupabaseProvider implements StorageProvider {
  private client: SupabaseClient;
  private bucket: string;

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly appConfigService: AppConfigService,
  ) {
    const config = this.appConfigService.getSupabaseConfig();
    const supabaseKey = config.storageKey || config.anonKey;

    if (!config.url || !supabaseKey) {
      throw new Error(
        "Supabase configuration missing: SUPABASE_URL and SUPABASE_STORAGE_KEY are required",
      );
    }

    this.client = createClient(config.url, supabaseKey);
    this.bucket = config.bucket;

    // Only ensure bucket exists if not in test environment
    // This is non-blocking - runs in background and won't prevent app startup
    if (!this.appConfigService.isTestEnvironment()) {
      // Use setImmediate to ensure this doesn't block constructor
      setImmediate(() => {
        this.ensureBucketExists().catch((error) => {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "ensureBucketExists",
              error,
              {
                bucket: this.bucket,
              },
            ),
            "Failed to ensure bucket exists",
          );
        });
      });
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const { data, error } = await this.client.storage.listBuckets();
      if (error) throw error;

      const bucketExists = data?.some((b) => b.name === this.bucket);
      if (!bucketExists) {
        const { error: createError } = await this.client.storage.createBucket(
          this.bucket,
          {
            public: true,
          },
        );
        if (createError) throw createError;
        this.logger.info(
          createLogContext(this.contextService, "ensureBucketExists", {
            bucket: this.bucket,
          }),
          "Created bucket",
        );
      }
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "ensureBucketExists", error, {
          bucket: this.bucket,
        }),
        "Bucket check/create failed",
      );
    }
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
    bucket?: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    try {
      const targetBucket = bucket || this.bucket;
      const uploadOptions: {
        contentType: string;
        upsert: boolean;
        cacheControl?: string;
        metadata?: Record<string, string>;
      } = {
        contentType,
        upsert: true,
      };

      if (metadata?.CacheControl) {
        uploadOptions.cacheControl = metadata.CacheControl;
      }

      if (metadata) {
        uploadOptions.metadata = Object.fromEntries(
          Object.entries(metadata).filter(([k]) => k !== "CacheControl"),
        );
      }

      const { error } = await this.client.storage
        .from(targetBucket)
        .upload(key, buffer, uploadOptions);

      if (error) throw error;

      return this.getUrl(key, bucket);
    } catch (error) {
      this.logger.error(
        `Failed to upload file ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async delete(key: string, bucket?: string): Promise<void> {
    try {
      const targetBucket = bucket || this.bucket;
      const { error } = await this.client.storage
        .from(targetBucket)
        .remove([key]);
      if (error) throw error;
    } catch (error) {
      this.logger.error(
        `Failed to delete file ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getUrl(key: string, bucket?: string): Promise<string> {
    try {
      const targetBucket = bucket || this.bucket;
      const { data } = this.client.storage.from(targetBucket).getPublicUrl(key);
      return data.publicUrl;
    } catch (error) {
      this.logger.error(
        `Failed to get URL for ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to get URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getPresignedUrl(
    key: string,
    expiresIn = 3600,
    bucket?: string,
  ): Promise<string> {
    try {
      const targetBucket = bucket || this.bucket;
      const { data, error } = await this.client.storage
        .from(targetBucket)
        .createSignedUploadUrl(key, {
          upsert: true,
        });

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getSignedDownloadUrl(
    key: string,
    expiresIn = 3600,
    bucket?: string,
  ): Promise<string> {
    try {
      const targetBucket = bucket || this.bucket;
      const { data, error } = await this.client.storage
        .from(targetBucket)
        .createSignedUrl(key, expiresIn);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate signed download URL for ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to generate signed download URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async exists(key: string, bucket?: string): Promise<boolean> {
    try {
      const targetBucket = bucket || this.bucket;
      const { data, error } = await this.client.storage
        .from(targetBucket)
        .list(key.split("/").slice(0, -1).join("/"));
      if (error) return false;
      const fileName = key.split("/").pop();
      return data?.some((file) => file.name === fileName) ?? false;
    } catch {
      return false;
    }
  }

  async list(
    prefix: string,
    maxKeys = 1000,
    bucket?: string,
  ): Promise<string[]> {
    try {
      const targetBucket = bucket || this.bucket;
      const { data, error } = await this.client.storage
        .from(targetBucket)
        .list(prefix, {
          limit: maxKeys,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) throw error;

      return (data || []).map((file) =>
        `${prefix}/${file.name}`.replace(/\/\//g, "/"),
      );
    } catch (error) {
      this.logger.error(
        `Failed to list files with prefix ${prefix}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getMetadata(
    key: string,
    bucket?: string,
  ): Promise<{ size: number; contentType?: string }> {
    try {
      const targetBucket = bucket || this.bucket;
      const pathParts = key.split("/");
      const fileName = pathParts.pop() || "";
      const folderPath = pathParts.join("/");

      const { data, error } = await this.client.storage
        .from(targetBucket)
        .list(folderPath || "", {
          limit: 1000,
        });

      if (error) throw error;

      const file = data?.find((f) => f.name === fileName);
      if (!file) {
        throw new Error(`File not found: ${key}`);
      }

      // Supabase file objects have metadata property with size and mimetype
      // The structure may vary, so we check multiple possible locations
      interface SupabaseFile {
        metadata?: { size?: number; mimetype?: string };
        size?: number;
        mimetype?: string;
      }
      const typedFile = file as SupabaseFile;
      const size = typedFile.metadata?.size || typedFile.size || 0;
      const contentType =
        typedFile.metadata?.mimetype || typedFile.mimetype || undefined;

      return {
        size: typeof size === "number" ? size : 0,
        contentType: typeof contentType === "string" ? contentType : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get metadata for ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to get file metadata: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
