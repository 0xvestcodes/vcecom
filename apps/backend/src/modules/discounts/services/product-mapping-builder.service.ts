import { Inject, Injectable } from "@nestjs/common";
import {
  eq,
  inArray,
  productCollections,
  productTags,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  ProductMapping,
  VariantMapping,
} from "../../redis-store/stores/product-mapping-store";

@Injectable()
export class ProductMappingBuilder {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Build product mapping (collections, tags, variants)
   */
  async buildProductMapping(productId: string): Promise<ProductMapping> {
    try {
      // Get collections for product
      const collections = await this.db
        .select({ collectionId: productCollections.collectionId })
        .from(productCollections)
        .where(eq(productCollections.productId, productId));

      // Get tags for product
      const tags = await this.db
        .select({ tagId: productTags.tagId })
        .from(productTags)
        .where(eq(productTags.productId, productId));

      // Get variants for product
      const variants = await this.db
        .select({ variantId: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.productId, productId));

      return {
        collections: collections.map((c) => c.collectionId),
        tags: tags.map((t) => t.tagId),
        variants: variants.map((v) => v.variantId),
      };
    } catch (error) {
      this.logger.error(
        `Failed to build product mapping for product ${productId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Build variant mapping (product, collections, tags)
   */
  async buildVariantMapping(variantId: string): Promise<VariantMapping> {
    try {
      // Get variant to get product ID
      const [variant] = await this.db
        .select({ productId: productVariants.productId })
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);

      if (!variant) {
        throw new Error(`Variant ${variantId} not found`);
      }

      // Get collections for product
      const collections = await this.db
        .select({ collectionId: productCollections.collectionId })
        .from(productCollections)
        .where(eq(productCollections.productId, variant.productId));

      // Get tags for product
      const tags = await this.db
        .select({ tagId: productTags.tagId })
        .from(productTags)
        .where(eq(productTags.productId, variant.productId));

      return {
        productId: variant.productId,
        collections: collections.map((c) => c.collectionId),
        tags: tags.map((t) => t.tagId),
      };
    } catch (error) {
      this.logger.error(
        `Failed to build variant mapping for variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Build collection mapping (products in collection)
   */
  async buildCollectionMapping(collectionId: string): Promise<string[]> {
    try {
      const productCollectionsData = await this.db
        .select({ productId: productCollections.productId })
        .from(productCollections)
        .where(eq(productCollections.collectionId, collectionId));

      return productCollectionsData.map((pc) => pc.productId);
    } catch (error) {
      this.logger.error(
        `Failed to build collection mapping for collection ${collectionId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Build tag mapping (products with tag)
   */
  async buildTagMapping(tagId: string): Promise<string[]> {
    try {
      const productTagsData = await this.db
        .select({ productId: productTags.productId })
        .from(productTags)
        .where(eq(productTags.tagId, tagId));

      return productTagsData.map((pt) => pt.productId);
    } catch (error) {
      this.logger.error(
        `Failed to build tag mapping for tag ${tagId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Build mappings batch for multiple products
   */
  async buildMappingsBatch(
    productIds: string[],
  ): Promise<Map<string, ProductMapping>> {
    const mappings = new Map<string, ProductMapping>();

    if (productIds.length === 0) {
      return mappings;
    }

    try {
      // Batch fetch collections
      const collections = await this.db
        .select({
          productId: productCollections.productId,
          collectionId: productCollections.collectionId,
        })
        .from(productCollections)
        .where(inArray(productCollections.productId, productIds));

      // Batch fetch tags
      const tags = await this.db
        .select({
          productId: productTags.productId,
          tagId: productTags.tagId,
        })
        .from(productTags)
        .where(inArray(productTags.productId, productIds));

      // Batch fetch variants
      const variants = await this.db
        .select({
          productId: productVariants.productId,
          variantId: productVariants.id,
        })
        .from(productVariants)
        .where(inArray(productVariants.productId, productIds));

      // Group by product ID
      const collectionsByProduct = new Map<string, string[]>();
      const tagsByProduct = new Map<string, string[]>();
      const variantsByProduct = new Map<string, string[]>();

      for (const c of collections) {
        if (!collectionsByProduct.has(c.productId)) {
          collectionsByProduct.set(c.productId, []);
        }
        collectionsByProduct.get(c.productId)?.push(c.collectionId);
      }

      for (const t of tags) {
        if (!tagsByProduct.has(t.productId)) {
          tagsByProduct.set(t.productId, []);
        }
        tagsByProduct.get(t.productId)?.push(t.tagId);
      }

      for (const v of variants) {
        if (!variantsByProduct.has(v.productId)) {
          variantsByProduct.set(v.productId, []);
        }
        variantsByProduct.get(v.productId)?.push(v.variantId);
      }

      // Build mappings
      for (const productId of productIds) {
        mappings.set(productId, {
          collections: collectionsByProduct.get(productId) || [],
          tags: tagsByProduct.get(productId) || [],
          variants: variantsByProduct.get(productId) || [],
        });
      }

      return mappings;
    } catch (error) {
      this.logger.error(
        `Failed to build mappings batch: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }
}
