import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, bundleSetItems, bundleSets, bundles, eq } from "@vcecom/db";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { BundleCacheStore } from "../../redis-store/stores/bundle-cache-store";
import { CreateBundleSetDto } from "../dto/create-bundle-set.dto";
import { UpdateBundleSetDto } from "../dto/update-bundle-set.dto";
import { BundleDefinitionService } from "./bundle-definition.service";

@Injectable()
export class BundleSetsService {
  constructor(
    private readonly bundleDefinitionService: BundleDefinitionService,
    private readonly bundleCacheStore: BundleCacheStore,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Create a new choice set for a bundle
   */
  async create(
    bundleId: string,
    dto: CreateBundleSetDto,
  ): Promise<{ id: string; message: string }> {
    // Validate bundle exists
    const [bundle] = await this.db
      .select()
      .from(bundles)
      .where(eq(bundles.id, bundleId))
      .limit(1);

    if (!bundle) {
      throw new NotFoundException(`Bundle with ID ${bundleId} not found`);
    }

    // Validate max 15 sets per bundle
    await this.bundleDefinitionService.validateBundleSetCount(bundleId);

    // Validate minQuantity <= maxQuantity (already validated in DTO, but double-check)
    if (dto.minQuantity > dto.maxQuantity) {
      throw new BadRequestException(
        "minQuantity must be less than or equal to maxQuantity",
      );
    }

    // Validate maxQuantity <= 15 (already validated in DTO)
    if (dto.maxQuantity > 15) {
      throw new BadRequestException("maxQuantity cannot exceed 15");
    }

    // Get current max sortOrder for this bundle
    const existingSets = await this.db
      .select()
      .from(bundleSets)
      .where(eq(bundleSets.bundleId, bundleId));

    const maxSortOrder =
      existingSets.length > 0
        ? Math.max(...existingSets.map((s) => s.sortOrder))
        : -1;

    const [newSet] = await this.db
      .insert(bundleSets)
      .values({
        bundleId,
        title: dto.title,
        description: dto.description || null,
        minQuantity: dto.minQuantity,
        maxQuantity: dto.maxQuantity,
        sortOrder: maxSortOrder + 1,
      })
      .returning();

    // Invalidate bundle cache
    await this.bundleCacheStore.invalidateBundle(bundleId);

    return {
      id: newSet.id,
      message: "Bundle set created successfully",
    };
  }

  /**
   * Update a choice set
   */
  async update(
    bundleId: string,
    setId: string,
    dto: UpdateBundleSetDto,
  ): Promise<{ message: string }> {
    // Validate bundle exists
    const [bundle] = await this.db
      .select()
      .from(bundles)
      .where(eq(bundles.id, bundleId))
      .limit(1);

    if (!bundle) {
      throw new NotFoundException(`Bundle with ID ${bundleId} not found`);
    }

    // Validate set exists and belongs to bundle
    const [set] = await this.db
      .select()
      .from(bundleSets)
      .where(and(eq(bundleSets.id, setId), eq(bundleSets.bundleId, bundleId)))
      .limit(1);

    if (!set) {
      throw new NotFoundException(
        `Bundle set with ID ${setId} not found in bundle ${bundleId}`,
      );
    }

    // Validate quantity constraints if updating
    const minQuantity = dto.minQuantity ?? set.minQuantity;
    const maxQuantity = dto.maxQuantity ?? set.maxQuantity;

    if (minQuantity > maxQuantity) {
      throw new BadRequestException(
        "minQuantity must be less than or equal to maxQuantity",
      );
    }

    if (maxQuantity > 15) {
      throw new BadRequestException("maxQuantity cannot exceed 15");
    }

    // Validate set has at least 1 item if updating maxQuantity
    if (dto.maxQuantity !== undefined && dto.maxQuantity < set.maxQuantity) {
      const items = await this.db
        .select()
        .from(bundleSetItems)
        .where(eq(bundleSetItems.setId, setId));

      if (items.length > dto.maxQuantity) {
        throw new BadRequestException(
          `Cannot set maxQuantity to ${dto.maxQuantity} because set has ${items.length} items. Remove items first.`,
        );
      }
    }

    await this.db
      .update(bundleSets)
      .set({
        title: dto.title ?? set.title,
        description:
          dto.description !== undefined ? dto.description : set.description,
        minQuantity,
        maxQuantity,
        updatedAt: new Date(),
      })
      .where(eq(bundleSets.id, setId));

    // Invalidate bundle cache
    await this.bundleCacheStore.invalidateBundle(bundleId);

    return { message: "Bundle set updated successfully" };
  }

  /**
   * Delete a choice set (cascades to items)
   */
  async remove(bundleId: string, setId: string): Promise<{ message: string }> {
    // Validate bundle exists
    const [bundle] = await this.db
      .select()
      .from(bundles)
      .where(eq(bundles.id, bundleId))
      .limit(1);

    if (!bundle) {
      throw new NotFoundException(`Bundle with ID ${bundleId} not found`);
    }

    // Validate set exists and belongs to bundle
    const [set] = await this.db
      .select()
      .from(bundleSets)
      .where(and(eq(bundleSets.id, setId), eq(bundleSets.bundleId, bundleId)))
      .limit(1);

    if (!set) {
      throw new NotFoundException(
        `Bundle set with ID ${setId} not found in bundle ${bundleId}`,
      );
    }

    await this.db.delete(bundleSets).where(eq(bundleSets.id, setId));

    // Invalidate bundle cache
    await this.bundleCacheStore.invalidateBundle(bundleId);

    return { message: "Bundle set deleted successfully" };
  }

  /**
   * Validate set has at least 1 item
   */
  async validateSetHasItems(setId: string): Promise<void> {
    const items = await this.db
      .select()
      .from(bundleSetItems)
      .where(eq(bundleSetItems.setId, setId));

    if (items.length === 0) {
      throw new BadRequestException("Bundle set must have at least 1 item");
    }
  }
}
