import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  bundleSetItems,
  bundleSets,
  bundles,
  eq,
  productVariants,
} from "@vcecom/db";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { BundleCacheStore } from "../../redis-store/stores/bundle-cache-store";
import { AddBundleSetItemDto } from "../dto/add-bundle-set-item.dto";

@Injectable()
export class BundleSetItemsService {
  constructor(
    private readonly bundleCacheStore: BundleCacheStore,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}
  /**
   * Add a variant to a bundle set
   */
  async addItem(
    bundleId: string,
    setId: string,
    dto: AddBundleSetItemDto,
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

    // Validate variant exists
    const [variant] = await this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, dto.variantId))
      .limit(1);

    if (!variant) {
      throw new NotFoundException(
        `Product variant with ID ${dto.variantId} not found`,
      );
    }

    // Validate variant is active (check product status)
    // Note: We assume variant is active if product exists
    // In Phase 14-2, we might add more sophisticated checks

    // Duplicates are now allowed in bundle sets
    // No duplicate check needed

    const [newItem] = await this.db
      .insert(bundleSetItems)
      .values({
        setId,
        variantId: dto.variantId,
      })
      .returning();

    // Invalidate bundle cache
    await this.bundleCacheStore.invalidateBundle(bundleId);

    return {
      id: newItem.id,
      message: "Item added to bundle set successfully",
    };
  }

  /**
   * Remove an item from a bundle set
   */
  async removeItem(
    bundleId: string,
    setId: string,
    itemId: string,
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

    // Validate item exists and belongs to set
    const [item] = await this.db
      .select()
      .from(bundleSetItems)
      .where(
        and(eq(bundleSetItems.id, itemId), eq(bundleSetItems.setId, setId)),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException(
        `Bundle set item with ID ${itemId} not found in set ${setId}`,
      );
    }

    // Check if removing this item would leave set empty
    const remainingItems = await this.db
      .select()
      .from(bundleSetItems)
      .where(eq(bundleSetItems.setId, setId));

    if (remainingItems.length === 1) {
      throw new BadRequestException(
        "Cannot remove the last item from a bundle set. Bundle sets must have at least 1 item.",
      );
    }

    await this.db.delete(bundleSetItems).where(eq(bundleSetItems.id, itemId));

    // Invalidate bundle cache
    await this.bundleCacheStore.invalidateBundle(bundleId);

    return { message: "Item removed from bundle set successfully" };
  }
}
