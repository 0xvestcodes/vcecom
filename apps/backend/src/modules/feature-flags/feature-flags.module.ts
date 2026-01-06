import { Module } from "@nestjs/common";
import { ConfigModule } from "../../common/config/config.module";
import { ContextModule } from "../../common/logging/context.module";
import { LoggerModule } from "../../common/logging/logger.module";
import { DatabaseModule } from "../database/database.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { FeatureFlagsController } from "./feature-flags.controller";
import { FeatureFlagsService } from "./feature-flags.service";
import { FeatureFlagsCacheHydrationService } from "./services/feature-flags-cache-hydration.service";

@Module({
  imports: [
    DatabaseModule,
    RedisStoreModule,
    ConfigModule,
    LoggerModule,
    ContextModule,
  ],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, FeatureFlagsCacheHydrationService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
