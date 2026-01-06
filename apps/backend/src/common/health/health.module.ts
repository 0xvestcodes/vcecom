import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AdminModule } from "../../modules/admin/admin.module";
import { DatabaseModule } from "../../modules/database/database.module";
import { StorageModule } from "../../modules/storage/storage.module";
import { ConfigModule } from "../config/config.module";
import { ContextModule } from "../logging/context.module";
import { HealthCheckScheduler } from "./health-check.scheduler";

@Module({
  imports: [
    ScheduleModule,
    AdminModule, // For RedisHealthService
    DatabaseModule, // For DatabaseService and DB_TOKEN
    StorageModule, // For StorageService
    ConfigModule, // For AppConfigService (global, but explicit for clarity)
    ContextModule, // For ContextService (global, but explicit for clarity)
  ],
  providers: [HealthCheckScheduler],
  exports: [HealthCheckScheduler],
})
export class HealthModule {}
