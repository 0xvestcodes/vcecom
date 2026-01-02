import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ThemeController } from "./theme.controller";
import { ThemeService } from "./theme.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ThemeController],
  providers: [ThemeService],
  exports: [ThemeService],
})
export class ThemeModule {}
