import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  asc,
  bundleSetItems,
  bundleSets,
  bundles,
  desc,
  eq,
  sql,
} from "@vcecom/db";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { BundleCacheStore } from "../../redis-store/stores/bundle-cache-store";
import { BundleResponseDto } from "../dto/bundle-response.dto";
import { CreateBundleDto } from "../dto/create-bundle.dto";
import { UpdateBundleDto } from "../dto/update-bundle.dto";

@Injectable()
export class BundleDefinitionService {
  constructor(
    private readonly bundleCacheStore: BundleCacheStore,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}
  /**
   * Create a new bundle
   * Note: Bundle must have at least 1 set (enforced when sets are added)
   */
  async create(dto: CreateBundleDto): Promise<BundleResponseDto> {
    const [newBundle] = await this.db
      .insert(bundles)
      .values({
        title: dto.title,
        description: dto.description || null,
        isActive: dto.isActive ?? true,
        allowMixAndMatch: dto.allowMixAndMatch ?? false,
      })
      .returning();

    const bundle = await this.hydrateBundle(newBundle.id);

    // Cache the new bundle
    try {
      await this.bundleCacheStore.storeBundleDefinition(newBundle.id, bundle);
    } catch (error) {
      console.warn(`Failed to cache new bundle ${newBundle.id}:`, error);
    }

    return bundle;
  }

  /**
   * Get all bundles with pagination
   */
  async findAll(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 100); // Max 100 per page

    const allBundles = await this.db
      .select()
      .from(bundles)
      .orderBy(desc(bundles.createdAt))
      .limit(maxLimit)
      .offset(offset);

    // Get total count using COUNT(*) for performance
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(bundles);
    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / maxLimit);

    const hydratedBundles = await Promise.all(
      allBundles.map((bundle) => this.hydrateBundle(bundle.id)),
    );

    return {
      data: hydratedBundles,
      total,
      page,
      limit: maxLimit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Get all active bundles with pagination (for storefront)
   */
  async findAllActive(
    page = 1,
    limit = 10,
  ): Promise<{
    data: BundleResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }> {
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 100); // Max 100 per page

    const activeBundles = await this.db
      .select()
      .from(bundles)
      .where(eq(bundles.isActive, true))
      .orderBy(desc(bundles.createdAt))
      .limit(maxLimit)
      .offset(offset);

    // Get total count of active bundles
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(bundles)
      .where(eq(bundles.isActive, true));
    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / maxLimit);

    const hydratedBundles = await Promise.all(
      activeBundles.map((bundle) => this.hydrateBundle(bundle.id)),
    );

    return {
      data: hydratedBundles,
      total,
      page,
      limit: maxLimit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Get a single bundle with all sets and items (hydrated)
   * Tries cache first, falls back to DB
   */
  async findOne(id: string): Promise<BundleResponseDto> {
    // Try cache first
    const cached = await this.bundleCacheStore.getBundleDefinition(id);
    if (cached) {
      return cached;
    }

    // Fallback to DB
    const bundle = await this.hydrateBundle(id);

    // Store in cache for next time
    try {
      await this.bundleCacheStore.storeBundleDefinition(id, bundle);
    } catch (error) {
      // Log but don't throw - cache failure shouldn't break the request
      console.warn(`Failed to cache bundle ${id}:`, error);
    }

    return bundle;
  }

  /**
   * Get a single active bundle (for storefront)
   */
  async findOneActive(id: string): Promise<BundleResponseDto> {
    // Try cache first
    const cached = await this.bundleCacheStore.getBundleDefinition(id);
    if (cached) {
      if (!cached.isActive) {
        throw new NotFoundException(
          `Bundle with ID ${id} not found or not active`,
        );
      }
      return cached;
    }

    // Check if bundle exists and is active
    const [bundle] = await this.db
      .select()
      .from(bundles)
      .where(eq(bundles.id, id))
      .limit(1);

    if (!bundle) {
      throw new NotFoundException(`Bundle with ID ${id} not found`);
    }

    if (!bundle.isActive) {
      throw new NotFoundException(`Bundle with ID ${id} is not active`);
    }

    // Hydrate and return
    const hydratedBundle = await this.hydrateBundle(id);

    // Store in cache for next time
    try {
      await this.bundleCacheStore.storeBundleDefinition(id, hydratedBundle);
    } catch (error) {
      // Log but don't throw - cache failure shouldn't break the request
      console.warn(`Failed to cache bundle ${id}:`, error);
    }

    return hydratedBundle;
  }

  /**
   * Update a bundle
   */
  async update(id: string, dto: UpdateBundleDto): Promise<BundleResponseDto> {
    const [existing] = await this.db
      .select()
      .from(bundles)
      .where(eq(bundles.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Bundle with ID ${id} not found`);
    }

    const [updated] = await this.db
      .update(bundles)
      .set({
        title: dto.title ?? existing.title,
        description:
          dto.description !== undefined
            ? dto.description
            : existing.description,
        isActive: dto.isActive ?? existing.isActive,
        allowMixAndMatch: dto.allowMixAndMatch ?? existing.allowMixAndMatch,
        updatedAt: new Date(),
      })
      .where(eq(bundles.id, id))
      .returning();

    // Invalidate cache
    await this.bundleCacheStore.invalidateBundle(id);

    const bundle = await this.hydrateBundle(updated.id);

    // Re-cache updated bundle
    try {
      await this.bundleCacheStore.storeBundleDefinition(id, bundle);
    } catch (error) {
      console.warn(`Failed to cache updated bundle ${id}:`, error);
    }

    return bundle;
  }

  /**
   * Delete a bundle (cascades to sets and items)
   */
  async remove(id: string): Promise<{ message: string }> {
    const [existing] = await this.db
      .select()
      .from(bundles)
      .where(eq(bundles.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Bundle with ID ${id} not found`);
    }

    await this.db.delete(bundles).where(eq(bundles.id, id));

    // Invalidate cache
    await this.bundleCacheStore.invalidateBundle(id);

    return { message: "Bundle deleted successfully" };
  }

  /**
   * Validate bundle has at least 1 set
   */
  async validateBundleHasSets(bundleId: string): Promise<void> {
    const sets = await this.db
      .select()
      .from(bundleSets)
      .where(eq(bundleSets.bundleId, bundleId));

    if (sets.length === 0) {
      throw new BadRequestException("Bundle must have at least 1 choice set");
    }
  }

  /**
   * Validate bundle has at most 15 sets
   */
  async validateBundleSetCount(bundleId: string): Promise<void> {
    const sets = await this.db
      .select()
      .from(bundleSets)
      .where(eq(bundleSets.bundleId, bundleId));

    if (sets.length >= 15) {
      throw new BadRequestException(
        "Bundle cannot have more than 15 choice sets",
      );
    }
  }

  /**
   * Get bundle count for a bundle
   */
  async getSetCount(bundleId: string): Promise<number> {
    const sets = await this.db
      .select()
      .from(bundleSets)
      .where(eq(bundleSets.bundleId, bundleId));

    return sets.length;
  }

  /**
   * Hydrate bundle with sets and items
   */
  private async hydrateBundle(bundleId: string): Promise<BundleResponseDto> {
    const [bundle] = await this.db
      .select()
      .from(bundles)
      .where(eq(bundles.id, bundleId))
      .limit(1);

    if (!bundle) {
      throw new NotFoundException(`Bundle with ID ${bundleId} not found`);
    }

    // Get sets ordered by sortOrder
    const sets = await this.db
      .select()
      .from(bundleSets)
      .where(eq(bundleSets.bundleId, bundleId))
      .orderBy(asc(bundleSets.sortOrder), asc(bundleSets.createdAt));

    // Get items for each set
    const setsWithItems = await Promise.all(
      sets.map(async (set) => {
        const items = await this.db
          .select()
          .from(bundleSetItems)
          .where(eq(bundleSetItems.setId, set.id));

        return {
          id: set.id,
          title: set.title,
          description: set.description || undefined,
          minQuantity: set.minQuantity,
          maxQuantity: set.maxQuantity,
          sortOrder: set.sortOrder,
          items: items.map((item) => ({
            id: item.id,
            variantId: item.variantId,
            createdAt: item.createdAt,
          })),
          createdAt: set.createdAt,
          updatedAt: set.updatedAt,
        };
      }),
    );

    return {
      id: bundle.id,
      title: bundle.title,
      description: bundle.description || undefined,
      isActive: bundle.isActive,
      allowMixAndMatch: bundle.allowMixAndMatch,
      sets: setsWithItems,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    };
  }
}
