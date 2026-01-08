import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  eq,
  ilike,
  inArray,
  mediaGroups,
  mediaItems,
  or,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { PaginatedResponseDto } from "../../common/dto/pagination.dto";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import {
  generatePaginationMetadata,
  normalizePaginationParams,
} from "../../common/utils/pagination.utils";
import { generateSlug } from "../../common/utils/slug.utils";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { CreateMediaGroupDto } from "./dto/create-media-group.dto";
import { CreateMediaItemDto } from "./dto/create-media-item.dto";
import { MediaGroupResponseDto } from "./dto/media-group-response.dto";
import { MediaItemResponseDto } from "./dto/media-item-response.dto";
import { QueryMediaGroupsDto } from "./dto/query-media-groups.dto";
import { ReorderItemsDto } from "./dto/reorder-items.dto";
import { UpdateMediaGroupDto } from "./dto/update-media-group.dto";
import { UpdateMediaItemDto } from "./dto/update-media-item.dto";

@Injectable()
export class MediaGroupsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Generate a slug from a name
   */
  private generateSlugFromName(name: string): string {
    return generateSlug(name);
  }

  /**
   * Ensure slug is unique by appending a number if needed
   */
  private async ensureUniqueSlug(
    baseSlug: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existingResult = await this.db
        .select()
        .from(mediaGroups)
        .where(eq(mediaGroups.slug, slug))
        .limit(1);

      const existing = existingResult[0];

      if (!existing || existing.id === excludeId) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Create a new media group
   */
  async createGroup(
    dto: CreateMediaGroupDto,
    userId?: string,
  ): Promise<MediaGroupResponseDto> {
    // Generate slug if not provided
    const slug = dto.slug
      ? await this.ensureUniqueSlug(dto.slug)
      : await this.ensureUniqueSlug(this.generateSlugFromName(dto.name));

    try {
      const [newGroup] = await this.db
        .insert(mediaGroups)
        .values({
          name: dto.name,
          slug,
          description: dto.description || null,
          displayOrder: dto.displayOrder ?? 0,
          isActive: dto.isActive ?? true,
          metadata: dto.metadata || null,
          createdBy: userId || null,
          updatedBy: userId || null,
        })
        .returning();

      if (!newGroup) {
        throw new InternalServerErrorException("Failed to create media group");
      }

      return this.mapGroupToDto(newGroup);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MediaGroupsService.createGroup",
          error,
          { dto },
        ),
        "Failed to create media group",
      );

      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new BadRequestException(
          `Media group with name "${dto.name}" or slug "${slug}" already exists`,
        );
      }

      throw new InternalServerErrorException("Failed to create media group");
    }
  }

  /**
   * Update a media group
   */
  async updateGroup(
    id: string,
    dto: UpdateMediaGroupDto,
    userId?: string,
  ): Promise<MediaGroupResponseDto> {
    // Check if group exists
    const [existing] = await this.db
      .select()
      .from(mediaGroups)
      .where(eq(mediaGroups.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Media group with ID "${id}" not found`);
    }

    // Handle slug update
    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await this.ensureUniqueSlug(dto.slug, id);
    } else if (dto.name && dto.name !== existing.name) {
      // Auto-generate slug if name changed but slug not provided
      slug = await this.ensureUniqueSlug(
        this.generateSlugFromName(dto.name),
        id,
      );
    }

    try {
      const [updated] = await this.db
        .update(mediaGroups)
        .set({
          name: dto.name ?? existing.name,
          slug,
          description:
            dto.description !== undefined
              ? dto.description
              : existing.description,
          displayOrder: dto.displayOrder ?? existing.displayOrder,
          isActive: dto.isActive ?? existing.isActive,
          metadata:
            dto.metadata !== undefined ? dto.metadata : existing.metadata,
          updatedBy: userId || null,
          updatedAt: sql`now()`,
        })
        .where(eq(mediaGroups.id, id))
        .returning();

      if (!updated) {
        throw new InternalServerErrorException("Failed to update media group");
      }

      return this.mapGroupToDto(updated);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MediaGroupsService.updateGroup",
          error,
          { id, dto },
        ),
        "Failed to update media group",
      );

      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new BadRequestException(
          `Media group with name "${dto.name}" or slug "${slug}" already exists`,
        );
      }

      throw new InternalServerErrorException("Failed to update media group");
    }
  }

  /**
   * Delete a media group (cascade deletes items)
   */
  async deleteGroup(id: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(mediaGroups)
      .where(eq(mediaGroups.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Media group with ID "${id}" not found`);
    }

    try {
      await this.db.delete(mediaGroups).where(eq(mediaGroups.id, id));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MediaGroupsService.deleteGroup",
          error,
          { id },
        ),
        "Failed to delete media group",
      );
      throw new InternalServerErrorException("Failed to delete media group");
    }
  }

  /**
   * List all media groups with pagination
   */
  async findAll(
    query: QueryMediaGroupsDto,
  ): Promise<PaginatedResponseDto<MediaGroupResponseDto>> {
    const { page, limit, offset } = normalizePaginationParams(
      query.page,
      query.limit,
    );

    const conditions: Parameters<typeof and>[0][] = [];

    // Search filter
    if (query.search) {
      const searchCondition = or(
        ilike(mediaGroups.name, `%${query.search}%`),
        ilike(mediaGroups.description, `%${query.search}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Active filter
    if (query.isActive !== undefined) {
      conditions.push(eq(mediaGroups.isActive, query.isActive));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(mediaGroups)
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);

    // Get groups
    const queryBuilder = this.db
      .select()
      .from(mediaGroups)
      .where(whereClause)
      .orderBy(mediaGroups.displayOrder, mediaGroups.createdAt);

    const groups = await queryBuilder.limit(limit).offset(offset);

    // Get image counts for each group
    const groupIds = groups.map((g) => g.id);
    const imageCounts = await this.db
      .select({
        groupId: mediaItems.groupId,
        count: sql<number>`count(*)`,
      })
      .from(mediaItems)
      .where(
        and(
          inArray(mediaItems.groupId, groupIds),
          eq(mediaItems.isActive, true),
        ),
      )
      .groupBy(mediaItems.groupId);

    const countMap = new Map(
      imageCounts.map((ic) => [ic.groupId, Number(ic.count)]),
    );

    const data = groups.map((group) => ({
      ...this.mapGroupToDto(group),
      imageCount: countMap.get(group.id) || 0,
    }));

    const pagination = generatePaginationMetadata(total, page, limit);

    return {
      data,
      pagination,
    };
  }

  /**
   * Get a media group by ID
   */
  async findOne(id: string): Promise<MediaGroupResponseDto> {
    const [group] = await this.db
      .select()
      .from(mediaGroups)
      .where(eq(mediaGroups.id, id))
      .limit(1);

    if (!group) {
      throw new NotFoundException(`Media group with ID "${id}" not found`);
    }

    // Get image count
    const imageCountResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(mediaItems)
      .where(and(eq(mediaItems.groupId, id), eq(mediaItems.isActive, true)));

    const imageCount = Number(imageCountResult[0]?.count || 0);

    return {
      ...this.mapGroupToDto(group),
      imageCount,
    };
  }

  /**
   * Get a media group by slug
   */
  async findBySlug(slug: string): Promise<MediaGroupResponseDto> {
    const [group] = await this.db
      .select()
      .from(mediaGroups)
      .where(eq(mediaGroups.slug, slug))
      .limit(1);

    if (!group) {
      throw new NotFoundException(`Media group with slug "${slug}" not found`);
    }

    // Get image count
    const imageCountResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(mediaItems)
      .where(
        and(eq(mediaItems.groupId, group.id), eq(mediaItems.isActive, true)),
      );

    const imageCount = Number(imageCountResult[0]?.count || 0);

    return {
      ...this.mapGroupToDto(group),
      imageCount,
    };
  }

  /**
   * Get all active groups
   */
  async findActiveGroups(): Promise<MediaGroupResponseDto[]> {
    const groups = await this.db
      .select()
      .from(mediaGroups)
      .where(eq(mediaGroups.isActive, true))
      .orderBy(mediaGroups.displayOrder, mediaGroups.createdAt);

    return groups.map((group) => this.mapGroupToDto(group));
  }

  /**
   * Add an image item to a group
   */
  async addItem(
    dto: CreateMediaItemDto,
    userId?: string,
  ): Promise<MediaItemResponseDto> {
    // Verify group exists
    const [group] = await this.db
      .select()
      .from(mediaGroups)
      .where(eq(mediaGroups.id, dto.groupId))
      .limit(1);

    if (!group) {
      throw new NotFoundException(
        `Media group with ID "${dto.groupId}" not found`,
      );
    }

    try {
      const [newItem] = await this.db
        .insert(mediaItems)
        .values({
          groupId: dto.groupId,
          storageKey: dto.storageKey,
          url: dto.url,
          altText: dto.altText || null,
          caption: dto.caption || null,
          displayOrder: dto.displayOrder ?? 0,
          linkUrl: dto.linkUrl || null,
          isActive: dto.isActive ?? true,
          metadata: dto.metadata || null,
          createdBy: userId || null,
          updatedBy: userId || null,
        })
        .returning();

      if (!newItem) {
        throw new InternalServerErrorException("Failed to create media item");
      }

      return this.mapItemToDto(newItem);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MediaGroupsService.addItem",
          error,
          { dto },
        ),
        "Failed to create media item",
      );
      throw new InternalServerErrorException("Failed to create media item");
    }
  }

  /**
   * Update a media item
   */
  async updateItem(
    id: string,
    dto: UpdateMediaItemDto,
    userId?: string,
  ): Promise<MediaItemResponseDto> {
    const [existing] = await this.db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Media item with ID "${id}" not found`);
    }

    try {
      const [updated] = await this.db
        .update(mediaItems)
        .set({
          altText: dto.altText !== undefined ? dto.altText : existing.altText,
          caption: dto.caption !== undefined ? dto.caption : existing.caption,
          displayOrder: dto.displayOrder ?? existing.displayOrder,
          linkUrl: dto.linkUrl !== undefined ? dto.linkUrl : existing.linkUrl,
          isActive: dto.isActive ?? existing.isActive,
          metadata:
            dto.metadata !== undefined ? dto.metadata : existing.metadata,
          updatedBy: userId || null,
          updatedAt: sql`now()`,
        })
        .where(eq(mediaItems.id, id))
        .returning();

      if (!updated) {
        throw new InternalServerErrorException("Failed to update media item");
      }

      return this.mapItemToDto(updated);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MediaGroupsService.updateItem",
          error,
          { id, dto },
        ),
        "Failed to update media item",
      );
      throw new InternalServerErrorException("Failed to update media item");
    }
  }

  /**
   * Delete a media item
   */
  async deleteItem(id: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Media item with ID "${id}" not found`);
    }

    try {
      await this.db.delete(mediaItems).where(eq(mediaItems.id, id));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MediaGroupsService.deleteItem",
          error,
          { id },
        ),
        "Failed to delete media item",
      );
      throw new InternalServerErrorException("Failed to delete media item");
    }
  }

  /**
   * Reorder items in a group
   */
  async reorderItems(
    groupId: string,
    dto: ReorderItemsDto,
  ): Promise<MediaItemResponseDto[]> {
    // Verify group exists
    const [group] = await this.db
      .select()
      .from(mediaGroups)
      .where(eq(mediaGroups.id, groupId))
      .limit(1);

    if (!group) {
      throw new NotFoundException(`Media group with ID "${groupId}" not found`);
    }

    // Verify all items belong to this group
    const items = await this.db
      .select()
      .from(mediaItems)
      .where(
        and(
          eq(mediaItems.groupId, groupId),
          inArray(mediaItems.id, dto.itemIds),
        ),
      );

    if (items.length !== dto.itemIds.length) {
      throw new BadRequestException(
        "Some items do not belong to this group or do not exist",
      );
    }

    // Update display order
    try {
      const updates = dto.itemIds.map((itemId, index) =>
        this.db
          .update(mediaItems)
          .set({ displayOrder: index })
          .where(eq(mediaItems.id, itemId)),
      );

      await Promise.all(updates);

      // Return updated items
      const updatedItems = await this.db
        .select()
        .from(mediaItems)
        .where(
          and(
            eq(mediaItems.groupId, groupId),
            inArray(mediaItems.id, dto.itemIds),
          ),
        )
        .orderBy(mediaItems.displayOrder);

      return updatedItems.map((item) => this.mapItemToDto(item));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MediaGroupsService.reorderItems",
          error,
          { groupId, dto },
        ),
        "Failed to reorder items",
      );
      throw new InternalServerErrorException("Failed to reorder items");
    }
  }

  /**
   * Get all items in a group
   */
  async findByGroup(
    groupId: string,
    activeOnly = false,
  ): Promise<MediaItemResponseDto[]> {
    // Verify group exists
    const [group] = await this.db
      .select()
      .from(mediaGroups)
      .where(eq(mediaGroups.id, groupId))
      .limit(1);

    if (!group) {
      throw new NotFoundException(`Media group with ID "${groupId}" not found`);
    }

    const conditions = [eq(mediaItems.groupId, groupId)];

    if (activeOnly) {
      conditions.push(eq(mediaItems.isActive, true));
    }

    const items = await this.db
      .select()
      .from(mediaItems)
      .where(and(...conditions))
      .orderBy(mediaItems.displayOrder, mediaItems.createdAt);

    return items.map((item) => this.mapItemToDto(item));
  }

  /**
   * Get active items by group slug
   */
  async findActiveByGroupSlug(slug: string): Promise<MediaItemResponseDto[]> {
    const [group] = await this.db
      .select()
      .from(mediaGroups)
      .where(and(eq(mediaGroups.slug, slug), eq(mediaGroups.isActive, true)))
      .limit(1);

    if (!group) {
      throw new NotFoundException(
        `Active media group with slug "${slug}" not found`,
      );
    }

    const items = await this.db
      .select()
      .from(mediaItems)
      .where(
        and(eq(mediaItems.groupId, group.id), eq(mediaItems.isActive, true)),
      )
      .orderBy(mediaItems.displayOrder, mediaItems.createdAt);

    return items.map((item) => this.mapItemToDto(item));
  }

  /**
   * Map database group to DTO
   */
  private mapGroupToDto(
    group: typeof mediaGroups.$inferSelect,
  ): MediaGroupResponseDto {
    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      displayOrder: group.displayOrder,
      isActive: group.isActive,
      metadata: group.metadata,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  /**
   * Map database item to DTO
   */
  private mapItemToDto(
    item: typeof mediaItems.$inferSelect,
  ): MediaItemResponseDto {
    return {
      id: item.id,
      groupId: item.groupId,
      storageKey: item.storageKey,
      url: item.url,
      altText: item.altText,
      caption: item.caption,
      displayOrder: item.displayOrder,
      linkUrl: item.linkUrl,
      isActive: item.isActive,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
