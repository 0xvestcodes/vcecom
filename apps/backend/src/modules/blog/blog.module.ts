import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { StoresModule } from "../stores/stores.module";
import { BlogPostsController } from "./blog-posts.controller";
import { BlogPostsService } from "./blog-posts.service";

@Module({
  imports: [DatabaseModule, StoresModule],
  controllers: [BlogPostsController],
  providers: [BlogPostsService],
  exports: [BlogPostsService],
})
export class BlogModule {}
