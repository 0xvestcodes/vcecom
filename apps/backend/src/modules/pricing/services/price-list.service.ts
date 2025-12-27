import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, priceListItems, priceLists } from "@vcecom/db";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  CreatePriceListDto,
  CreatePriceListItemDto,
} from "../dto/create-price-list.dto";
import { PriceListResponseDto } from "../dto/price-list-response.dto";
import { PriceListChangeTracker } from "./price-list-change-tracker.service";

@Injectable()
export class PriceListService {
  constructor(
    private readonly changeTracker: PriceListChangeTracker,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Create a new price list
   */
  async create(createDto: CreatePriceListDto): Promise<PriceListResponseDto> {
    const [newPriceList] = await this.db
      .insert(priceLists)
      .values({
        name: createDto.name,
        description: createDto.description || null,
        type: createDto.type || "CUSTOM",
        priority: createDto.priority || 1,
        isActive:
          createDto.isActive !== undefined ? (createDto.isActive ? 1 : 0) : 1,
        startDate: createDto.startDate || null,
        endDate: createDto.endDate || null,
      })
      .returning();

    const result = await this.findOne(newPriceList.id);

    // Track price list creation
    await this.changeTracker.trackPriceListCreated(result);

    return result;
  }

  /**
   * Get all price lists
   */
  async findAll(): Promise<PriceListResponseDto[]> {
    const lists = await this.db
      .select()
      .from(priceLists)
      .orderBy(desc(priceLists.priority));

    return Promise.all(lists.map((list) => this.enrichPriceList(list)));
  }

  /**
   * Get active price lists (for current date)
   */
  async findActive(now: Date = new Date()): Promise<PriceListResponseDto[]> {
    const lists = await this.db
      .select()
      .from(priceLists)
      .where(
        and(
          eq(priceLists.isActive, 1),
          // Date range check is done at application level for flexibility
        ),
      )
      .orderBy(desc(priceLists.priority));

    // Filter by date range
    const activeLists = lists.filter((list) => {
      if (list.startDate && new Date(list.startDate) > now) {
        return false;
      }
      if (list.endDate && new Date(list.endDate) < now) {
        return false;
      }
      return true;
    });

    return Promise.all(activeLists.map((list) => this.enrichPriceList(list)));
  }

  /**
   * Get price list by ID
   */
  async findOne(id: string): Promise<PriceListResponseDto> {
    const [list] = await this.db
      .select()
      .from(priceLists)
      .where(eq(priceLists.id, id))
      .limit(1);

    if (!list) {
      throw new NotFoundException(`Price list with ID ${id} not found`);
    }

    return this.enrichPriceList(list);
  }

  /**
   * Update a price list
   */
  async update(
    id: string,
    updateDto: Partial<CreatePriceListDto>,
  ): Promise<PriceListResponseDto> {
    const existing = await this.findOne(id);

    const updateData: Partial<typeof priceLists.$inferInsert> = {};
    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description || null;
    if (updateDto.type !== undefined) updateData.type = updateDto.type;
    if (updateDto.priority !== undefined)
      updateData.priority = updateDto.priority;
    if (updateDto.isActive !== undefined)
      updateData.isActive = updateDto.isActive ? 1 : 0;
    if (updateDto.startDate !== undefined)
      updateData.startDate = updateDto.startDate || null;
    if (updateDto.endDate !== undefined)
      updateData.endDate = updateDto.endDate || null;

    await this.db
      .update(priceLists)
      .set(updateData)
      .where(eq(priceLists.id, id));

    const updated = await this.findOne(id);

    // Track price list update
    await this.changeTracker.trackPriceListUpdated(existing, updated);

    return updated;
  }

  /**
   * Delete a price list
   */
  async remove(id: string): Promise<{ message: string }> {
    const existing = await this.findOne(id);

    await this.db.delete(priceLists).where(eq(priceLists.id, id));

    // Track price list deletion
    await this.changeTracker.trackPriceListDeleted(existing);

    return { message: "Price list deleted successfully" };
  }

  /**
   * Add item to price list
   */
  async addItem(
    priceListId: string,
    createItemDto: CreatePriceListItemDto,
  ): Promise<PriceListResponseDto> {
    // Validate price list exists
    await this.findOne(priceListId);

    // Validate that exactly one of variant/product/category is set
    const hasVariant = !!createItemDto.productVariantId;
    const hasProduct = !!createItemDto.productId;
    const hasCategory = !!createItemDto.categoryId;

    const count = [hasVariant, hasProduct, hasCategory].filter(Boolean).length;
    if (count !== 1) {
      throw new BadRequestException(
        "Exactly one of productVariantId, productId, or categoryId must be set",
      );
    }

    // Validate override value based on type
    if (createItemDto.overrideType === "PERCENTAGE") {
      if (
        createItemDto.overrideValue < 0 ||
        createItemDto.overrideValue > 100
      ) {
        throw new BadRequestException(
          "Percentage override value must be between 0 and 100",
        );
      }
    }

    await this.db.insert(priceListItems).values({
      priceListId,
      productVariantId: createItemDto.productVariantId || null,
      productId: createItemDto.productId || null,
      categoryId: createItemDto.categoryId || null,
      overrideType: createItemDto.overrideType,
      overrideValue: createItemDto.overrideValue,
    });

    return this.findOne(priceListId);
  }

  /**
   * Remove item from price list
   */
  async removeItem(
    priceListId: string,
    itemId: string,
  ): Promise<PriceListResponseDto> {
    // Validate price list exists
    await this.findOne(priceListId);

    const [item] = await this.db
      .select()
      .from(priceListItems)
      .where(
        and(
          eq(priceListItems.id, itemId),
          eq(priceListItems.priceListId, priceListId),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException(
        `Price list item with ID ${itemId} not found in price list ${priceListId}`,
      );
    }

    await this.db.delete(priceListItems).where(eq(priceListItems.id, itemId));

    return this.findOne(priceListId);
  }

  /**
   * Enrich price list with items
   */
  private async enrichPriceList(
    list: typeof priceLists.$inferSelect,
  ): Promise<PriceListResponseDto> {
    const items = await this.db
      .select()
      .from(priceListItems)
      .where(eq(priceListItems.priceListId, list.id));

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      type: list.type as PriceListResponseDto["type"],
      priority: list.priority,
      isActive: list.isActive === 1,
      startDate: list.startDate,
      endDate: list.endDate,
      items: items.map((item) => ({
        id: item.id,
        priceListId: item.priceListId,
        productVariantId: item.productVariantId,
        productId: item.productId,
        categoryId: item.categoryId,
        overrideType:
          item.overrideType as PriceListResponseDto["items"][0]["overrideType"],
        overrideValue: item.overrideValue,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    };
  }
}
