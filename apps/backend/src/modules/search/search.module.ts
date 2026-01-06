import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule } from "../../common/config/config.module";
import { SearchAvailableGuard } from "../../common/guards/search-available.guard";
import { ContextModule } from "../../common/logging/context.module";
import { LoggerModule } from "../../common/logging/logger.module";
import { MetricsModule } from "../../common/metrics/metrics.module";
import { AdminModule } from "../admin/admin.module";
import { DatabaseModule } from "../database/database.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { StorageModule } from "../storage/storage.module";
// Controllers
import { AdminSearchController } from "./controllers/admin-search.controller";
import { CollectionsIndexingService } from "./indexing/collections-indexing.service";
import { ProductsIndexingService } from "./indexing/products-indexing.service";
import { VariantIndexingService } from "./indexing/variant-indexing.service";
import { ElasticsearchProvider } from "./providers/elasticsearch.provider";
// Providers
import { MeilisearchProvider } from "./providers/meilisearch.provider";
import { OpenSearchProvider } from "./providers/opensearch.provider";
import { RelevanceConfigService } from "./relevance/relevance-config.service";
import { RelevanceTunerService } from "./relevance/relevance-tuner.service";
// Services
import { SearchIndexerService } from "./search-indexer.service";
import { SearchQueryService } from "./search-query.service";
import { SearchCacheHydrationService } from "./services/search-cache-hydration.service";
import { ReindexWorkerService } from "./workers/reindex-worker.service";

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    ContextModule,
    DatabaseModule,
    RedisStoreModule,
    StorageModule,
    MetricsModule.forRoot(),
    forwardRef(() => AdminModule),
  ],
  providers: [
    // Guards
    SearchAvailableGuard,
    // Search providers
    MeilisearchProvider,
    ElasticsearchProvider,
    OpenSearchProvider,
    // Core services
    SearchIndexerService,
    SearchQueryService,
    // Indexing services
    ProductsIndexingService,
    CollectionsIndexingService,
    VariantIndexingService,
    // Workers
    ReindexWorkerService,
    // Relevance
    RelevanceConfigService,
    RelevanceTunerService,
    // Cache hydration
    SearchCacheHydrationService,
  ],
  controllers: [AdminSearchController],
  exports: [
    SearchIndexerService,
    SearchQueryService,
    ProductsIndexingService,
    CollectionsIndexingService,
    VariantIndexingService,
    ReindexWorkerService,
    RelevanceConfigService,
    RelevanceTunerService,
  ],
})
export class SearchModule {}
