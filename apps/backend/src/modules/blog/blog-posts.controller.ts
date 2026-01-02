import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { BlogPostsService } from "./blog-posts.service";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export class CreateBlogPostDto {
  slug!: string;
  title!: string;
  excerpt?: string;
  featuredImage?: string;
  content!: string;
  seo?: { title?: string; description?: string; og_image?: string };
}

export class UpdateBlogPostDto {
  slug?: string;
  title?: string;
  excerpt?: string;
  featuredImage?: string;
  content?: string;
  seo?: { title?: string; description?: string; og_image?: string };
}

@ApiTags("store", "blog")
@Controller("store/blog")
@Public()
export class BlogPostsController {
  constructor(private readonly blogPostsService: BlogPostsService) {}

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "List published blog posts",
    description: "Returns paginated list of published blog posts",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["newest", "oldest", "alphabetical"],
  })
  @ApiQuery({
    name: "storeId",
    required: false,
    type: String,
  })
  @ApiOkResponse({ description: "Blog posts retrieved successfully" })
  async listBlogPosts(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: "newest" | "oldest" | "alphabetical",
    @Query("storeId") storeId?: string,
  ) {
    return this.blogPostsService.listBlogPosts(storeId, {
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      search,
      sortBy,
    });
  }

  @Get(":slug")
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get blog post by slug",
    description: "Returns single published blog post by slug",
  })
  @ApiParam({ name: "slug", description: "Blog post slug" })
  @ApiQuery({
    name: "storeId",
    required: false,
    type: String,
  })
  @ApiOkResponse({ description: "Blog post retrieved successfully" })
  @ApiNotFoundResponse({ description: "Blog post not found" })
  async getBlogPost(
    @Param("slug") slug: string,
    @Query("storeId") storeId?: string,
  ) {
    return this.blogPostsService.getBlogPostBySlug(storeId, slug, true);
  }
}

@ApiTags("admin", "blog")
@Controller("admin/blog")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden" })
export class AdminBlogPostsController {
  constructor(private readonly blogPostsService: BlogPostsService) {}

  @Get()
  @Roles("admin", "support", "reviewer", "marketing")
  @ApiOperation({
    summary: "List all blog posts (admin)",
    description: "Returns paginated list of all blog posts (including drafts)",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["newest", "oldest", "alphabetical"],
  })
  @ApiQuery({
    name: "storeId",
    required: false,
    type: String,
  })
  @ApiOkResponse({ description: "Blog posts retrieved successfully" })
  async listBlogPosts(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: "newest" | "oldest" | "alphabetical",
    @Query("storeId") storeId?: string,
  ) {
    return this.blogPostsService.listBlogPosts(
      storeId,
      {
        page: page ? Number.parseInt(page, 10) : undefined,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
        search,
        sortBy,
      },
      false,
    );
  }

  @Post()
  @Roles("admin", "marketing")
  @ApiOperation({
    summary: "Create blog post",
    description: "Creates a new blog post",
  })
  @ApiQuery({
    name: "storeId",
    required: false,
    type: String,
  })
  @ApiCreatedResponse({ description: "Blog post created successfully" })
  @ApiBadRequestResponse({ description: "Validation failed" })
  async createBlogPost(
    @Body() dto: CreateBlogPostDto,
    @Query("storeId") storeId?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    const userId = req?.user?.id;
    if (!userId) {
      throw new Error("User ID not found in request");
    }
    return this.blogPostsService.createBlogPost(storeId, dto, userId);
  }

  @Get(":id")
  @Roles("admin", "support", "reviewer", "marketing")
  @ApiOperation({
    summary: "Get blog post by ID (admin)",
    description: "Returns blog post by ID (includes drafts)",
  })
  @ApiParam({ name: "id", description: "Blog post ID" })
  @ApiOkResponse({ description: "Blog post retrieved successfully" })
  @ApiNotFoundResponse({ description: "Blog post not found" })
  async getBlogPost(@Param("id") id: string) {
    return this.blogPostsService.getBlogPostById(id);
  }

  @Put(":id")
  @Roles("admin", "marketing")
  @ApiOperation({
    summary: "Update blog post",
    description: "Updates an existing blog post",
  })
  @ApiParam({ name: "id", description: "Blog post ID" })
  @ApiOkResponse({ description: "Blog post updated successfully" })
  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiNotFoundResponse({ description: "Blog post not found" })
  async updateBlogPost(
    @Param("id") id: string,
    @Body() dto: UpdateBlogPostDto,
    @Request() req?: AuthenticatedRequest,
  ) {
    const userId = req?.user?.id;
    if (!userId) {
      throw new Error("User ID not found in request");
    }
    return this.blogPostsService.updateBlogPost(id, dto, userId);
  }

  @Delete(":id")
  @Roles("admin")
  @ApiOperation({
    summary: "Delete blog post",
    description: "Deletes a blog post",
  })
  @ApiParam({ name: "id", description: "Blog post ID" })
  @ApiOkResponse({ description: "Blog post deleted successfully" })
  @ApiNotFoundResponse({ description: "Blog post not found" })
  async deleteBlogPost(@Param("id") id: string) {
    return this.blogPostsService.deleteBlogPost(id);
  }

  @Put(":id/publish")
  @Roles("admin", "marketing")
  @ApiOperation({
    summary: "Publish/unpublish blog post",
    description: "Publishes or unpublishes a blog post",
  })
  @ApiParam({ name: "id", description: "Blog post ID" })
  @ApiQuery({ name: "published", required: true, type: Boolean })
  @ApiOkResponse({ description: "Blog post publish status updated" })
  @ApiNotFoundResponse({ description: "Blog post not found" })
  async publishBlogPost(
    @Param("id") id: string,
    @Query("published") published: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    const userId = req?.user?.id;
    if (!userId) {
      throw new Error("User ID not found in request");
    }
    const isPublished = published === "true";
    return this.blogPostsService.publishBlogPost(id, isPublished, userId);
  }
}
