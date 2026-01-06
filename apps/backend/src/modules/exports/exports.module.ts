import { Module } from "@nestjs/common";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { StorageModule } from "../storage/storage.module";
import { ExportsController } from "./exports.controller";
import { ExportsService } from "./exports.service";
import { CsvGenerator } from "./generators/csv.generator";
import { PdfGenerator } from "./generators/pdf.generator";
import { ZipGenerator } from "./generators/zip.generator";

@Module({
  imports: [StorageModule, RedisStoreModule],
  controllers: [ExportsController],
  providers: [ExportsService, CsvGenerator, PdfGenerator, ZipGenerator],
  exports: [ExportsService, CsvGenerator, PdfGenerator, ZipGenerator],
})
export class ExportsModule {}
