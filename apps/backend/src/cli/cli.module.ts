import { Module } from "@nestjs/common";
import { FixturesModule } from "../common/fixtures/fixtures.module";
import { ApiKeysModule } from "../modules/api-keys/api-keys.module";
import { DatabaseModule } from "../modules/database/database.module";

@Module({
  imports: [DatabaseModule, FixturesModule, ApiKeysModule],
})
export class CliModule {}
