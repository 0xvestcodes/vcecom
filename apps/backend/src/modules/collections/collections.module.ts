import { forwardRef, Module } from "@nestjs/common";
import { ProductsModule } from "../products/products.module";
import { SearchModule } from "../search/search.module";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";
import { StorefrontCollectionsController } from "./storefront-collections.controller";

@Module({
  imports: [forwardRef(() => ProductsModule), forwardRef(() => SearchModule)],
  controllers: [CollectionsController, StorefrontCollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
