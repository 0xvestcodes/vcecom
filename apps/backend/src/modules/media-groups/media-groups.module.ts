import { Module } from "@nestjs/common";
import { AdminMediaGroupsController } from "./admin-media-groups.controller";
import { MediaGroupsService } from "./media-groups.service";
import { StorefrontMediaGroupsController } from "./storefront-media-groups.controller";

@Module({
  imports: [],
  controllers: [AdminMediaGroupsController, StorefrontMediaGroupsController],
  providers: [MediaGroupsService],
  exports: [MediaGroupsService],
})
export class MediaGroupsModule {}
