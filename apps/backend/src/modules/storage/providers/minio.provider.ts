import { Injectable } from "@nestjs/common";
import * as Minio from "minio";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../../common/config/app.config.service";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { StorageProvider } from "../interfaces/storage-provider.interface";

@Injectable()
export class MinioProvider implements StorageProvider {
  private client: Minio.Client;
  private bucket: string;
  private publicUrl: string;

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly appConfigService: AppConfigService,
  ) {
    const config = this.appConfigService.getMinioConfig();
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;

    this.client = new Minio.Client({
      endPoint: config.endpoint.split(":")[0],
      port: parseInt(config.endpoint.split(":")[1] || "9000", 10),
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });

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
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket, "us-east-1");
      this.logger.info(
        createLogContext(this.contextService, "ensureBucketExists", {
          bucket: this.bucket,
        }),
        "Created bucket",
      );
    }

    // Always set bucket policy to public (allow read access to all objects)
    // This ensures the bucket is public even if it was created before
    try {
      const publicPolicy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };

      await this.client.setBucketPolicy(
        this.bucket,
        JSON.stringify(publicPolicy),
      );
      this.logger.info(
        createLogContext(this.contextService, "ensureBucketExists", {
          bucket: this.bucket,
        }),
        "Set bucket policy to public",
      );
    } catch (error) {
      // Log warning but don't fail - bucket might already have policy set or permissions issue
      this.logger.warn(
        createErrorContext(this.contextService, "ensureBucketExists", error, {
          bucket: this.bucket,
        }),
        "Failed to set bucket policy to public (this is non-critical)",
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
      const metaData: Record<string, string> = {
        "Content-Type": contentType,
        ...(metadata?.CacheControl && {
          "Cache-Control": metadata.CacheControl,
        }),
        ...metadata,
      };

      await this.client.putObject(
        targetBucket,
        key,
        buffer,
        buffer.length,
        metaData,
      );
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
      await this.client.removeObject(targetBucket, key);
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
    const targetBucket = bucket || this.bucket;
    // Update public URL if bucket changed
    if (bucket && bucket !== this.bucket) {
      const baseUrl = this.publicUrl.replace(`/${this.bucket}`, "");
      return `${baseUrl}/${targetBucket}/${key}`;
    }
    return `${this.publicUrl}/${key}`;
  }

  async getPresignedUrl(
    key: string,
    expiresIn = 3600,
    bucket?: string,
  ): Promise<string> {
    try {
      const targetBucket = bucket || this.bucket;
      return await this.client.presignedPutObject(targetBucket, key, expiresIn);
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
      return await this.client.presignedGetObject(targetBucket, key, expiresIn);
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
      await this.client.statObject(targetBucket, key);
      return true;
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
      const objects: string[] = [];
      const stream = this.client.listObjects(targetBucket, prefix, true);

      return new Promise((resolve, reject) => {
        stream.on("data", (obj) => {
          if (objects.length < maxKeys) {
            objects.push(obj.name || "");
          }
          if (objects.length >= maxKeys) {
            stream.destroy();
            resolve(objects);
          }
        });

        stream.on("end", () => {
          resolve(objects);
        });

        stream.on("error", (error) => {
          reject(error);
        });
      });
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
      const stat = await this.client.statObject(targetBucket, key);
      return {
        size: stat.size,
        contentType:
          stat.metaData?.["content-type"] || stat.metaData?.["Content-Type"],
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
