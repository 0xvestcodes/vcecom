/**
 * Unified interface for S3-compatible storage providers
 * Supports MINIO, Supabase Storage, and Amazon S3
 */
export interface StorageProvider {
  /**
   * Upload a file to storage
   * @param key - File key/path in storage
   * @param buffer - File buffer
   * @param contentType - MIME type of the file
   * @param bucket - Optional bucket name (overrides default)
   * @param metadata - Optional metadata headers (Cache-Control, ETag, etc.)
   * @returns Public URL of the uploaded file
   */
  upload(
    key: string,
    buffer: Buffer,
    contentType: string,
    bucket?: string,
    metadata?: Record<string, string>,
  ): Promise<string>;

  /**
   * Delete a file from storage
   * @param key - File key/path in storage
   * @param bucket - Optional bucket name (overrides default)
   */
  delete(key: string, bucket?: string): Promise<void>;

  /**
   * Get public URL for a file
   * @param key - File key/path in storage
   * @param bucket - Optional bucket name (overrides default)
   * @returns Public URL
   */
  getUrl(key: string, bucket?: string): Promise<string>;

  /**
   * Generate a presigned URL for direct upload
   * @param key - File key/path in storage
   * @param expiresIn - Expiration time in seconds (default: 3600)
   * @param bucket - Optional bucket name (overrides default)
   * @returns Presigned URL
   */
  getPresignedUrl(
    key: string,
    expiresIn?: number,
    bucket?: string,
  ): Promise<string>;

  /**
   * Generate a signed URL for downloading a file
   * @param key - File key/path in storage
   * @param expiresIn - Expiration time in seconds (default: 3600)
   * @param bucket - Optional bucket name (overrides default)
   * @returns Signed download URL
   */
  getSignedDownloadUrl(
    key: string,
    expiresIn?: number,
    bucket?: string,
  ): Promise<string>;

  /**
   * Check if a file exists
   * @param key - File key/path in storage
   * @param bucket - Optional bucket name (overrides default)
   * @returns True if file exists
   */
  exists(key: string, bucket?: string): Promise<boolean>;

  /**
   * List files in a prefix
   * @param prefix - Prefix to list files under
   * @param maxKeys - Maximum number of keys to return
   * @param bucket - Optional bucket name (overrides default)
   * @returns Array of file keys
   */
  list(prefix: string, maxKeys?: number, bucket?: string): Promise<string[]>;

  /**
   * Get file metadata (size, content type)
   * @param key - File key/path in storage
   * @param bucket - Optional bucket name (overrides default)
   * @returns File metadata with size and content type
   */
  getMetadata(
    key: string,
    bucket?: string,
  ): Promise<{ size: number; contentType?: string }>;
}

export type StorageProviderType = "minio" | "supabase" | "aws";
