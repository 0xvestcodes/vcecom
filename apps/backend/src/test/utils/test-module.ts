import { INestApplication } from "@nestjs/common";
import { Test, TestingModule, TestingModuleBuilder } from "@nestjs/testing";
import { Redis } from "ioredis";
import { AppModule } from "../../app.module";
import {
  DatabaseModule,
  DB_TOKEN,
} from "../../modules/database/database.module";
import { getDatabasePool } from "../../modules/database/db";
import { RedisStoreModule } from "../../modules/redis-store/redis-store.module";
import { RedisStoreService } from "../../modules/redis-store/services/redis-store.service";
import { clearTestDatabase } from "./test-database";

export async function createTestModule(
  moduleMetadata?: any,
): Promise<TestingModule> {
  if (!moduleMetadata) {
    moduleMetadata = { imports: [AppModule] };
  }
  return Test.createTestingModule(moduleMetadata).compile();
}

export async function createTestApp(
  moduleBuilder?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<{
  app: INestApplication;
  module: TestingModule;
  db: any;
  redis: Redis;
}> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (moduleBuilder) {
    builder = moduleBuilder(builder);
  }

  const moduleFixture = await builder.compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  const db = app.get(DB_TOKEN);
  const redisStoreService = app.get(RedisStoreService);
  const redisClient = await redisStoreService.getClient();

  // Clear database and Redis before each test suite
  await clearTestDatabase(db);
  await redisClient.flushdb();

  return { app, module: builder, db, redis: redisClient };
}
