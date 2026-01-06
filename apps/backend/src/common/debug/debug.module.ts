import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../modules/database/database.module";
import { RedisStoreModule } from "../../modules/redis-store/redis-store.module";
import { ConfigModule } from "../config/config.module";
import { DebugController } from "./debug.controller";

@Module({
  imports: [DatabaseModule, RedisStoreModule, ConfigModule],
  controllers: [DebugController],
})
export class DebugModule {}
