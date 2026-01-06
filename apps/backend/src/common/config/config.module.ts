import { Global, Module } from "@nestjs/common";
import { AppConfigService } from "./app.config.service";
import { EnvOverrideService } from "./env-override.service";
import { SandboxConfigService } from "./sandbox.config";

/**
 * Global configuration module
 * Provides centralized access to application configuration
 * This ensures configurable data is at high levels and follows dependency injection principles
 */
@Global()
@Module({
  providers: [AppConfigService, SandboxConfigService, EnvOverrideService],
  exports: [AppConfigService, SandboxConfigService, EnvOverrideService],
})
export class ConfigModule {}
