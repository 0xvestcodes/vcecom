import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../../common/config/app.config.service";
import { StorageProvider } from "../interfaces/storage-provider.interface";

@Injectable()
export class AwsS3Provider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private publicUrl: string | undefined;

  constructor(
    private readonly logger: PinoLogger,
    private readonly appConfigService: AppConfigService,
  ) {
    const config = this.appConfigService.getAwsS3Config();

    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error(
        "AWS S3 configuration missing: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required",
      );
    }

    this.region = config.region;
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
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
      const command = new PutObjectCommand({
        Bucket: targetBucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: metadata?.CacheControl,
        Metadata: metadata
          ? Object.fromEntries(
              Object.entries(metadata).filter(
                ([k]) => k !== "CacheControl" && k !== "ETag",
              ),
            )
          : undefined,
      });

      await this.client.send(command);
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
      const command = new DeleteObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      await this.client.send(command);
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
    const _targetBucket = bucket || this.bucket;
    // For public buckets, return public URL
    // For private buckets, return presigned URL (valid for 1 hour)
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }

    // Generate presigned URL for private buckets
    return this.getPresignedUrl(key, 3600, bucket);
  }

  async getPresignedUrl(
    key: string,
    expiresIn = 3600,
    bucket?: string,
  ): Promise<string> {
    try {
      const targetBucket = bucket || this.bucket;
      const command = new PutObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
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
      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
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
      const command = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      await this.client.send(command);
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
      const keys: string[] = [];
      let continuationToken: string | undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: targetBucket,
          Prefix: prefix,
          MaxKeys: Math.min(maxKeys - keys.length, 1000),
          ContinuationToken: continuationToken,
        });

        const response = await this.client.send(command);
        if (response.Contents) {
          keys.push(
            ...response.Contents.map((obj) => obj.Key || "").filter(Boolean),
          );
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken && keys.length < maxKeys);

      return keys;
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
      const command = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      const response = await this.client.send(command);
      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType,
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
