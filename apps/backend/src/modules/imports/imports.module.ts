import { forwardRef, Module } from "@nestjs/common";
import { CategoriesModule } from "../categories/categories.module";
import { CustomersModule } from "../customers/customers.module";
import { ExportsModule } from "../exports/exports.module";
import { InventoryModule } from "../inventory/inventory.module";
import { ProductsModule } from "../products/products.module";
import { QueueModule } from "../queue/queue.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { StorageModule } from "../storage/storage.module";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";
import { CsvParser } from "./parsers/csv.parser";
import { ExcelParser } from "./parsers/excel.parser";
import { JsonParser } from "./parsers/json.parser";
import { CategoryProcessor } from "./processors/category-processor";
import { CustomerProcessor } from "./processors/customer-processor";
import { InventoryProcessor } from "./processors/inventory-processor";
import { ProductProcessor } from "./processors/product-processor";
import { ShopifyMapperService } from "./shopify/shopify-mapper.service";
import { ShopifyMigrationService } from "./shopify/shopify-migration.service";
import { ShopifySyncService } from "./shopify/shopify-sync.service";
import { TemplateGeneratorService } from "./templates/template-generator.service";
import { CategoryValidator } from "./validators/category-validator";
import { CustomerValidator } from "./validators/customer-validator";
import { InventoryValidator } from "./validators/inventory-validator";
import { ProductValidator } from "./validators/product-validator";

@Module({
  imports: [
    StorageModule,
    forwardRef(() => QueueModule),
    RedisStoreModule,
    ExportsModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => CategoriesModule),
    forwardRef(() => CustomersModule),
    forwardRef(() => InventoryModule),
  ],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    // Parsers
    CsvParser,
    ExcelParser,
    JsonParser,
    // Validators
    ProductValidator,
    CategoryValidator,
    InventoryValidator,
    CustomerValidator,
    // Processors
    ProductProcessor,
    CategoryProcessor,
    InventoryProcessor,
    CustomerProcessor,
    // Template generator
    TemplateGeneratorService,
    // Shopify services
    ShopifyMapperService,
    ShopifyMigrationService,
    ShopifySyncService,
  ],
  exports: [ImportsService],
})
export class ImportsModule {}
