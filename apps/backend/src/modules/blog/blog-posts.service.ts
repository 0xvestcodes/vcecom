import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, blogPosts, desc, eq, ilike, or } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { DB_TOKEN } from "../database/database.module";
import type { Database } from "../database/db";
import { StoresService } from "../stores/stores.service";

export interface ListBlogPostsOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "newest" | "oldest" | "alphabetical";
}

@Injectable()
export class BlogPostsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly storesService: StoresService,
  ) {}

  /**
   * Get default store ID (helper method)
   */
  private async getDefaultStoreId(): Promise<string> {
    const store = await this.storesService.getStore();
    return store.id;
  }

  /**
   * Get store ID from request context or use default
   */
  private async getStoreId(storeId?: string): Promise<string> {
    if (storeId) {
      return storeId;
    }
    return this.getDefaultStoreId();
  }

  /**
   * List blog posts
   */
  async listBlogPosts(
    storeId: string | undefined,
    options: ListBlogPostsOptions = {},
    publishedOnly = true,
  ) {
    const actualStoreId = await this.getStoreId(storeId);
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    try {
      const conditions = [eq(blogPosts.storeId, actualStoreId)];

      if (publishedOnly) {
        conditions.push(eq(blogPosts.published, true));
      }

      if (options.search) {
        const searchCondition = or(
          ilike(blogPosts.title, `%${options.search}%`),
          ilike(blogPosts.excerpt, `%${options.search}%`),
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      // Get total count
      const totalResult = await this.db
        .select({ count: blogPosts.id })
        .from(blogPosts)
        .where(and(...conditions));

      const total = totalResult.length;

      // Build base query
      const baseQuery = this.db
        .select()
        .from(blogPosts)
        .where(and(...conditions));

      // Apply sorting and pagination
      const query =
        options.sortBy === "oldest"
          ? baseQuery.orderBy(asc(blogPosts.createdAt))
          : options.sortBy === "alphabetical"
            ? baseQuery.orderBy(asc(blogPosts.title))
            : baseQuery.orderBy(
                desc(blogPosts.publishedAt),
                desc(blogPosts.createdAt),
              );

      const posts = await query.limit(limit).offset(offset);

      const totalPages = Math.ceil(total / limit);

      this.logger.info(
        createLogContext(
          this.contextService,
          "BlogPostsService.listBlogPosts",
          { storeId: actualStoreId, total, page, limit },
        ),
        "Retrieved blog posts",
      );

      return {
        data: posts,
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "BlogPostsService.listBlogPosts",
          error,
          { storeId: actualStoreId, options },
        ),
        "Failed to list blog posts",
      );
      throw new InternalServerErrorException("Failed to list blog posts");
    }
  }

  /**
   * Get single blog post by slug
   */
  async getBlogPostBySlug(
    storeId: string | undefined,
    slug: string,
    publishedOnly = true,
  ) {
    const actualStoreId = await this.getStoreId(storeId);

    try {
      const conditions = [
        eq(blogPosts.storeId, actualStoreId),
        eq(blogPosts.slug, slug),
      ];

      if (publishedOnly) {
        conditions.push(eq(blogPosts.published, true));
      }

      const [post] = await this.db
        .select()
        .from(blogPosts)
        .where(and(...conditions))
        .limit(1);

      if (!post) {
        throw new NotFoundException(`Blog post not found: ${slug}`);
      }

      return post;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(
          this.contextService,
          "BlogPostsService.getBlogPostBySlug",
          error,
          { storeId: actualStoreId, slug },
        ),
        "Failed to get blog post",
      );
      throw new InternalServerErrorException("Failed to get blog post");
    }
  }

  /**
   * Get single blog post by ID
   */
  async getBlogPostById(id: string) {
    try {
      const [post] = await this.db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.id, id))
        .limit(1);

      if (!post) {
        throw new NotFoundException(`Blog post not found: ${id}`);
      }

      return post;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(
          this.contextService,
          "BlogPostsService.getBlogPostById",
          error,
          { id },
        ),
        "Failed to get blog post",
      );
      throw new InternalServerErrorException("Failed to get blog post");
    }
  }

  /**
   * Create blog post
   */
  async createBlogPost(
    storeId: string | undefined,
    data: {
      slug: string;
      title: string;
      excerpt?: string;
      featuredImage?: string;
      content: string;
      seo?: { title?: string; description?: string; og_image?: string };
    },
    userId: string,
  ) {
    const actualStoreId = await this.getStoreId(storeId);

    // Check if slug already exists for this store
    try {
      await this.getBlogPostBySlug(actualStoreId, data.slug, false);
      throw new BadRequestException(
        `Blog post with slug "${data.slug}" already exists`,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // NotFoundException is expected - slug doesn't exist, we can proceed
    }

    try {
      const [post] = await this.db
        .insert(blogPosts)
        .values({
          storeId: actualStoreId,
          slug: data.slug,
          title: data.title,
          excerpt: data.excerpt || null,
          featuredImage: data.featuredImage || null,
          content: data.content,
          published: false,
          seo: data.seo || null,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      this.logger.info(
        createLogContext(
          this.contextService,
          "BlogPostsService.createBlogPost",
          { storeId: actualStoreId, slug: data.slug, userId },
        ),
        "Blog post created",
      );

      return post;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "BlogPostsService.createBlogPost",
          error,
          { storeId: actualStoreId, data, userId },
        ),
        "Failed to create blog post",
      );
      throw new InternalServerErrorException("Failed to create blog post");
    }
  }

  /**
   * Update blog post
   */
  async updateBlogPost(
    id: string,
    data: {
      slug?: string;
      title?: string;
      excerpt?: string;
      featuredImage?: string;
      content?: string;
      seo?: { title?: string; description?: string; og_image?: string };
    },
    userId: string,
  ) {
    const existing = await this.getBlogPostById(id);

    // If slug is being changed, check if new slug exists
    if (data.slug && data.slug !== existing.slug) {
      try {
        await this.getBlogPostBySlug(existing.storeId, data.slug, false);
        throw new BadRequestException(
          `Blog post with slug "${data.slug}" already exists`,
        );
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        // NotFoundException is expected - slug doesn't exist, we can proceed
      }
    }

    try {
      const [updated] = await this.db
        .update(blogPosts)
        .set({
          slug: data.slug ?? existing.slug,
          title: data.title ?? existing.title,
          excerpt: data.excerpt ?? existing.excerpt ?? null,
          featuredImage: data.featuredImage ?? existing.featuredImage ?? null,
          content: data.content ?? existing.content,
          seo: data.seo ?? existing.seo ?? null,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(blogPosts.id, id))
        .returning();

      this.logger.info(
        createLogContext(
          this.contextService,
          "BlogPostsService.updateBlogPost",
          { id, userId },
        ),
        "Blog post updated",
      );

      return updated;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "BlogPostsService.updateBlogPost",
          error,
          { id, data, userId },
        ),
        "Failed to update blog post",
      );
      throw new InternalServerErrorException("Failed to update blog post");
    }
  }

  /**
   * Delete blog post
   */
  async deleteBlogPost(id: string) {
    const _existing = await this.getBlogPostById(id);

    try {
      await this.db.delete(blogPosts).where(eq(blogPosts.id, id));

      this.logger.info(
        createLogContext(
          this.contextService,
          "BlogPostsService.deleteBlogPost",
          { id },
        ),
        "Blog post deleted",
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "BlogPostsService.deleteBlogPost",
          error,
          { id },
        ),
        "Failed to delete blog post",
      );
      throw new InternalServerErrorException("Failed to delete blog post");
    }
  }

  /**
   * Publish/unpublish blog post
   */
  async publishBlogPost(id: string, published: boolean, userId: string) {
    const _existing = await this.getBlogPostById(id);

    try {
      const [updated] = await this.db
        .update(blogPosts)
        .set({
          published,
          publishedAt: published ? new Date() : null,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(blogPosts.id, id))
        .returning();

      this.logger.info(
        createLogContext(
          this.contextService,
          "BlogPostsService.publishBlogPost",
          { id, published, userId },
        ),
        `Blog post ${published ? "published" : "unpublished"}`,
      );

      return updated;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "BlogPostsService.publishBlogPost",
          error,
          { id, published, userId },
        ),
        "Failed to publish/unpublish blog post",
      );
      throw new InternalServerErrorException(
        "Failed to publish/unpublish blog post",
      );
    }
  }
}
