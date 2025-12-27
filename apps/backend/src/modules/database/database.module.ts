import { Global, Module } from "@nestjs/common";
import { ContextModule } from "../../common/logging/context.module";
import { LoggerModule } from "../../common/logging/logger.module";
import { DB_TOKEN } from "./database.constants";
import { DatabaseService } from "./database.service";
import { type Database, getDatabase } from "./db";

// Re-export DB_TOKEN for backward compatibility
export { DB_TOKEN } from "./database.constants";

@Global()
@Module({
  imports: [LoggerModule, ContextModule],
  providers: [
    DatabaseService,
    {
      provide: DB_TOKEN,
      useFactory: (): Database => {
        // Use factory to ensure true singleton - creates instance once and reuses it
        // This is critical for connection pool management in NestJS
        return getDatabase();
      },
    },
  ],
  exports: [DatabaseService, DB_TOKEN], // Export DB_TOKEN so other modules can inject it
})
export class DatabaseModule {}
