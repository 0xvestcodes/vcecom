import { Module } from "@nestjs/common";
import { FixturesService } from "./fixtures.service";

@Module({
  providers: [FixturesService],
  exports: [FixturesService],
})
export class FixturesModule {}
