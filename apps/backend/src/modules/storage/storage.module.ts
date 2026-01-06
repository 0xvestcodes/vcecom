import { DynamicModule, Module } from "@nestjs/common";
import { StorageProviderType } from "./interfaces/storage-provider.interface";
import { AwsS3Provider } from "./providers/aws-s3.provider";
import { MinioProvider } from "./providers/minio.provider";
import { SupabaseProvider } from "./providers/supabase.provider";
import { ImageCompressionService } from "./services/image-compression.service";
import { ImageResizePipelineService } from "./services/image-resize-pipeline.service";
import { MediaUrlService } from "./services/media-url.service";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";

/**
 * Helper function to determine which storage provider to use
 */
function detectStorageProvider(): StorageProviderType {
  const explicitProvider = process.env.STORAGE_PROVIDER?.toLowerCase();
  if (
    explicitProvider === "minio" ||
    explicitProvider === "supabase" ||
    explicitProvider === "aws"
  ) {
    return explicitProvider as StorageProviderType;
  }

  // Auto-detect based on available credentials
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return "aws";
  }
  if (
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_STORAGE_KEY || process.env.SUPABASE_ANON_KEY)
  ) {
    return "supabase";
  }

  // Default to MINIO
  return "minio";
}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Dynamic module pattern requires static method
export class StorageModule {
  /**
   * Dynamic module that conditionally registers only the selected storage provider
   */
  static forRootAsync(): DynamicModule {
    const providerType = detectStorageProvider();

    const providers: Array<
      | typeof StorageService
      | typeof ImageCompressionService
      | typeof ImageResizePipelineService
      | typeof MediaUrlService
      | typeof MinioProvider
      | typeof SupabaseProvider
      | typeof AwsS3Provider
    > = [
      StorageService,
      ImageCompressionService,
      ImageResizePipelineService,
      MediaUrlService,
    ];

    // Only register the selected provider
    switch (providerType) {
      case "minio":
        providers.push(MinioProvider);
        break;
      case "supabase":
        providers.push(SupabaseProvider);
        break;
      case "aws":
        providers.push(AwsS3Provider);
        break;
    }

    return {
      module: StorageModule,
      controllers: [StorageController],
      providers,
      exports: [
        StorageService,
        ImageCompressionService,
        ImageResizePipelineService,
        MediaUrlService,
      ],
      // LoggerModule and ContextModule are global, so no need to import them
      global: true, // Make it a global module so other modules can import it
    };
  }
}
