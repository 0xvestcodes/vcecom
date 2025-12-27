import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  eq,
  inArray,
  products,
  productVariants,
  variantOptionValueAssignments,
  variantOptionValues,
} from "@vcecom/db";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { InventoryStore } from "../redis-store/stores/inventory-store";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { UpdateVariantDto } from "./dto/update-variant.dto";

@Injectable()
export class VariantsService {
  constructor(
    private readonly inventoryStore: InventoryStore,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}
  /**
   * Generate a SKU from product and variant attributes
   */
  private async generateSku(
    productId: string,
    size?: string,
    color?: string,
  ): Promise<string> {
    // Get product title for SKU base
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Create base SKU from product title
    const baseSku = product.title
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 8);

    // Add variant attributes
    const parts = [baseSku];
    if (size) {
      parts.push(
        size
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .substring(0, 4),
      );
    }
    if (color) {
      parts.push(
        color
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .substring(0, 4),
      );
    }

    let sku = parts.join("-");
    let counter = 1;

    // Ensure SKU is unique
    while (true) {
      const [existing] = await this.db
        .select()
        .from(productVariants)
        .where(eq(productVariants.sku, sku))
        .limit(1);

      if (!existing) {
        break;
      }

      sku = `${parts[0]}-${counter}`;
      counter++;
    }

    return sku;
  }

  /**
   * Create a new product variant
   */
  async create(createVariantDto: CreateVariantDto) {
    // Validate product exists
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, createVariantDto.productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(
        `Product with ID ${createVariantDto.productId} not found`,
      );
    }

    // Generate SKU if not provided
    const sku = createVariantDto.sku
      ? await this.ensureUniqueSku(createVariantDto.sku)
      : await this.generateSku(
          createVariantDto.productId,
          createVariantDto.size,
          createVariantDto.color,
        );

    // Create variant
    const [newVariant] = await this.db
      .insert(productVariants)
      .values({
        productId: createVariantDto.productId,
        sku,
        price: createVariantDto.price,
        compareAtPrice: createVariantDto.compareAtPrice || null,
        currency: createVariantDto.currency || "INR",
        salePrice: createVariantDto.salePrice || null,
        saleStartDate: createVariantDto.saleStartDate || null,
        saleEndDate: createVariantDto.saleEndDate || null,
        inventory: createVariantDto.inventory ?? 0,
        size: createVariantDto.size || null,
        color: createVariantDto.color || null,
        weight: createVariantDto.weight || null,
      })
      .returning();

    // Handle option value assignments (new flexible system)
    if (
      createVariantDto.optionValueIds &&
      createVariantDto.optionValueIds.length > 0
    ) {
      // Validate all option values exist
      const optionValues = await this.db
        .select()
        .from(variantOptionValues)
        .where(
          inArray(variantOptionValues.id, createVariantDto.optionValueIds),
        );

      if (optionValues.length !== createVariantDto.optionValueIds.length) {
        throw new BadRequestException(
          "One or more option value IDs are invalid",
        );
      }

      // Create assignments
      await this.db.insert(variantOptionValueAssignments).values(
        createVariantDto.optionValueIds.map((optionValueId) => ({
          variantId: newVariant.id,
          optionValueId,
        })),
      );
    }

    // Sync inventory to Redis
    if (newVariant.inventory !== undefined) {
      await this.inventoryStore.setInventory(
        newVariant.id,
        newVariant.inventory,
      );
    }

    return newVariant;
  }

  /**
   * Get all variants for a product
   */
  async findByProductId(productId: string) {
    // Validate product exists
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    return this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId));
  }

  /**
   * Get variant by ID
   */
  async findOne(id: string) {
    const [variant] = await this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, id))
      .limit(1);

    if (!variant) {
      throw new NotFoundException(`Variant with ID ${id} not found`);
    }

    return variant;
  }

  /**
   * Get variant by SKU
   */
  async findBySku(sku: string) {
    const [variant] = await this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.sku, sku))
      .limit(1);

    if (!variant) {
      throw new NotFoundException(`Variant with SKU '${sku}' not found`);
    }

    return variant;
  }

  /**
   * Update a variant
   */
  async update(id: string, updateVariantDto: UpdateVariantDto) {
    // Check if variant exists
    const [existing] = await this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Variant with ID ${id} not found`);
    }

    // Ensure SKU uniqueness if provided
    let sku = updateVariantDto.sku;
    if (sku && sku !== existing.sku) {
      sku = await this.ensureUniqueSku(sku, id);
    }

    // Build update data
    const updateData: Partial<typeof productVariants.$inferInsert> = {};
    if (sku !== undefined) updateData.sku = sku;
    if (updateVariantDto.price !== undefined)
      updateData.price = updateVariantDto.price;
    if (updateVariantDto.compareAtPrice !== undefined)
      updateData.compareAtPrice = updateVariantDto.compareAtPrice || null;
    if (updateVariantDto.currency !== undefined)
      updateData.currency = updateVariantDto.currency;
    if (updateVariantDto.salePrice !== undefined)
      updateData.salePrice = updateVariantDto.salePrice || null;
    if (updateVariantDto.saleStartDate !== undefined)
      updateData.saleStartDate = updateVariantDto.saleStartDate || null;
    if (updateVariantDto.saleEndDate !== undefined)
      updateData.saleEndDate = updateVariantDto.saleEndDate || null;
    if (updateVariantDto.inventory !== undefined)
      updateData.inventory = updateVariantDto.inventory;
    if (updateVariantDto.size !== undefined)
      updateData.size = updateVariantDto.size || null;
    if (updateVariantDto.color !== undefined)
      updateData.color = updateVariantDto.color || null;
    if (updateVariantDto.weight !== undefined)
      updateData.weight = updateVariantDto.weight || null;

    // Update variant
    const [updated] = await this.db
      .update(productVariants)
      .set(updateData)
      .where(eq(productVariants.id, id))
      .returning();

    // Sync inventory to Redis if it was updated
    if (updateVariantDto.inventory !== undefined) {
      await this.inventoryStore.setInventory(id, updated.inventory);
    }

    // Handle option value assignments update (new flexible system)
    if (updateVariantDto.optionValueIds !== undefined) {
      // Delete existing assignments
      await this.db
        .delete(variantOptionValueAssignments)
        .where(eq(variantOptionValueAssignments.variantId, id));

      // Create new assignments if provided
      if (updateVariantDto.optionValueIds.length > 0) {
        // Validate all option values exist
        const optionValues = await this.db
          .select()
          .from(variantOptionValues)
          .where(
            inArray(variantOptionValues.id, updateVariantDto.optionValueIds),
          );

        if (optionValues.length !== updateVariantDto.optionValueIds.length) {
          throw new BadRequestException(
            "One or more option value IDs are invalid",
          );
        }

        // Create assignments
        await this.db.insert(variantOptionValueAssignments).values(
          updateVariantDto.optionValueIds.map((optionValueId) => ({
            variantId: id,
            optionValueId,
          })),
        );
      }
    }

    return updated;
  }

  /**
   * Delete a variant
   */
  async remove(id: string) {
    // Check if variant exists
    const [existing] = await this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Variant with ID ${id} not found`);
    }

    // Delete variant (images will be cascade deleted)
    await this.db.delete(productVariants).where(eq(productVariants.id, id));

    return { message: "Variant deleted successfully" };
  }

  /**
   * Ensure SKU is unique
   */
  private async ensureUniqueSku(
    baseSku: string,
    excludeId?: string,
  ): Promise<string> {
    let sku = baseSku;
    let counter = 1;

    while (true) {
      const [existing] = await this.db
        .select()
        .from(productVariants)
        .where(eq(productVariants.sku, sku))
        .limit(1);

      if (!existing || existing.id === excludeId) {
        break;
      }

      sku = `${baseSku}-${counter}`;
      counter++;
    }

    return sku;
  }
}
