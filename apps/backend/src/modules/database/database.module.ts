import { Global, Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ContextModule } from "../../common/logging/context.module";
import { LoggerModule } from "../../common/logging/logger.module";
import { DB_TOKEN } from "./database.constants";
import { DatabaseService } from "./database.service";
import { DatabaseBackupService } from "./database-backup.service";
import { type Database, getDatabase } from "./db";

// Re-export DB_TOKEN for backward compatibility
export { DB_TOKEN } from "./database.constants";

@Global()
@Module({
  imports: [
    LoggerModule,
    ContextModule,
    // Always import ScheduleModule (needed for cron jobs, including backups)
    ScheduleModule,
  ],
  providers: [
    DatabaseService,
    // Always provide DatabaseBackupService (it checks if backups are enabled internally)
    DatabaseBackupService,
    {
      provide: DB_TOKEN,
      useFactory: (): Database => {
        // Use factory to ensure true singleton - creates instance once and reuses it
        // This is critical for connection pool management in NestJS
        return getDatabase();
      },
    },
  ],
  exports: [
    DatabaseService,
    DatabaseBackupService, // Always export so it can be injected
    DB_TOKEN,
  ], // Export DB_TOKEN so other modules can inject it
})
export class DatabaseModule {}
