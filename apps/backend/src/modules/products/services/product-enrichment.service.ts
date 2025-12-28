import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  productImages,
  productVariants,
  productVariantOptionTypes,
  products,
  sql,
  variantOptionValueAssignments,
  variantOptionValues,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { StorageService } from "../../storage/storage.service";
import { EnrichedVariantDto } from "../dto/enriched-variant.dto";

/**
 * Cache entry for product enrichment
 */
interface EnrichmentCacheEntry {
  variants: EnrichedVariantDto[];
  expiresAt: number;
}

/**
 * Service for enriching variant data with complete product information
 * Fetches product details, images, attributes, and inventory status
 */
@Injectable()
export class ProductEnrichmentService {
  // In-memory cache for product enrichment (10 minute TTL)
  private readonly enrichmentCache = new Map<string, EnrichmentCacheEntry>();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    // Clean up expired cache entries every minute
    setInterval(() => this.cleanupCache(), 60 * 1000);
  }

  /**
   * Generate cache key for enrichment
   */
  private getCacheKey(variantIds: string[]): string {
    // Sort IDs for consistent cache key
    const sortedIds = [...variantIds].sort().join(",");
    return `enrich:${sortedIds}`;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.enrichmentCache.entries()) {
      if (entry.expiresAt < now) {
        this.enrichmentCache.delete(key);
      }
    }
  }

  /**
   * Enrich multiple variants with complete product data
   * Optimized batch query to fetch all data efficiently
   */
  async enrichVariants(variantIds: string[]): Promise<EnrichedVariantDto[]> {
    if (variantIds.length === 0) {
      return [];
    }

    // Check cache first
    const cacheKey = this.getCacheKey(variantIds);
    const cached = this.enrichmentCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.variants;
    }

    try {
      // Fetch all variant data with product info in a single query
      const variantsData = await this.db
        .select({
          variantId: productVariants.id,
          productId: productVariants.productId,
          sku: productVariants.sku,
          basePrice: productVariants.price,
          compareAtPrice: productVariants.compareAtPrice,
          currency: productVariants.currency,
          inventory: productVariants.inventory,
          size: productVariants.size,
          color: productVariants.color,
          productTitle: products.title,
          productDescription: products.description,
          gstRate: products.gstRate,
          hsnCode: products.hsnCode,
          isDigital: products.isDigital,
          isPreorder: products.isPreorder,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(inArray(productVariants.id, variantIds));

      if (variantsData.length === 0) {
        return [];
      }

      // Fetch variant option values (attributes) for all variants
      const variantAttributes = await this.fetchVariantAttributes(variantIds);

      // Fetch images for all variants
      const variantImages = await this.fetchVariantImages(
        variantsData.map((v) => ({
          variantId: v.variantId,
          productId: v.productId,
        })),
      );

      // Build enriched variants
      const enrichedVariants = await Promise.all(
        variantsData.map(async (variant) => {
          const attributes = variantAttributes.get(variant.variantId) || {};
          // Add direct size/color fields if they exist
          if (variant.size) {
            attributes.size = variant.size;
          }
          if (variant.color) {
            attributes.color = variant.color;
          }

          const images = variantImages.get(variant.variantId) || [];
          const thumbnail = images[0] || null;

          // Determine inventory status
          const inventoryStatus = this.determineInventoryStatus(
            variant.inventory,
          );

          // Build variant title from attributes
          const variantTitle = this.buildVariantTitle(attributes);

          return {
            variantId: variant.variantId,
            productId: variant.productId,
            productTitle: variant.productTitle,
            productSlug: undefined, // Products don't have slug field in schema
            productDescription: variant.productDescription,
            variantTitle,
            sku: variant.sku,
            attributes,
            basePrice: Number(variant.basePrice),
            compareAtPrice: variant.compareAtPrice
              ? Number(variant.compareAtPrice)
              : null,
            currency: variant.currency || "INR",
            thumbnail,
            images,
            inventoryQuantity: variant.inventory,
            inventoryStatus,
            gstRate: Number(variant.gstRate || 0),
            hsnCode: variant.hsnCode,
            isDigital: variant.isDigital || false,
            isPreorder: variant.isPreorder || false,
          };
        }),
      );

      // Cache the result
      this.enrichmentCache.set(cacheKey, {
        variants: enrichedVariants,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });

      return enrichedVariants;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ProductEnrichmentService.enrichVariants",
          error,
          { variantIds },
        ),
        "Failed to enrich variants",
      );
      throw error;
    }
  }

  /**
   * Fetch variant attributes (option values) for multiple variants
   */
  private async fetchVariantAttributes(
    variantIds: string[],
  ): Promise<Map<string, Record<string, string>>> {
    if (variantIds.length === 0) {
      return new Map();
    }

    try {
      const assignments = await this.db
        .select({
          variantId: variantOptionValueAssignments.variantId,
          optionTypeName: productVariantOptionTypes.name,
          optionValue: variantOptionValues.value,
        })
        .from(variantOptionValueAssignments)
        .innerJoin(
          variantOptionValues,
          eq(
            variantOptionValueAssignments.optionValueId,
            variantOptionValues.id,
          ),
        )
        .innerJoin(
          productVariantOptionTypes,
          eq(
            variantOptionValues.productVariantOptionTypeId,
            productVariantOptionTypes.id,
          ),
        )
        .where(inArray(variantOptionValueAssignments.variantId, variantIds));

      // Group by variant ID
      const attributesMap = new Map<string, Record<string, string>>();
      for (const assignment of assignments) {
        if (!attributesMap.has(assignment.variantId)) {
          attributesMap.set(assignment.variantId, {});
        }
        const attrs = attributesMap.get(assignment.variantId)!;
        attrs[assignment.optionTypeName] = assignment.optionValue;
      }

      return attributesMap;
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "ProductEnrichmentService.fetchVariantAttributes",
          {
            variantIds,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to fetch variant attributes, continuing without attributes",
      );
      return new Map();
    }
  }

  /**
   * Fetch images for variants (variant-specific first, then product fallback)
   */
  private async fetchVariantImages(
    variants: Array<{ variantId: string; productId: string }>,
  ): Promise<Map<string, string[]>> {
    if (variants.length === 0) {
      return new Map();
    }

    try {
      const variantIds = variants.map((v) => v.variantId);
      const productIds = [...new Set(variants.map((v) => v.productId))];

      // Fetch variant-specific images
      const variantSpecificImages = await this.db
        .select({
          variantId: productImages.variantId,
          url: productImages.url,
          order: productImages.order,
        })
        .from(productImages)
        .where(
          and(
            inArray(productImages.variantId, variantIds),
            sql`${productImages.variantId} IS NOT NULL`, // Ensure variantId is not null
          ),
        )
        .orderBy(asc(productImages.order));

      // Fetch product-level images (fallback)
      const productImagesData = await this.db
        .select({
          productId: productImages.productId,
          url: productImages.url,
          order: productImages.order,
        })
        .from(productImages)
        .where(
          and(
            inArray(productImages.productId, productIds),
            isNull(productImages.variantId), // Product-level images have null variantId
          ),
        )
        .orderBy(asc(productImages.order));

      // Group product images by product ID
      const productImagesMap = new Map<string, Array<{ url: string; order: number }>>();
      for (const img of productImagesData) {
        if (!productImagesMap.has(img.productId)) {
          productImagesMap.set(img.productId, []);
        }
        productImagesMap.get(img.productId)!.push({ url: img.url, order: img.order });
      }

      // Resolve S3 keys to URLs and build result map
      const imagesMap = new Map<string, string[]>();

      for (const variant of variants) {
        const images: string[] = [];

        // First, add variant-specific images
        const variantImgs = variantSpecificImages.filter(
          (img) => img.variantId === variant.variantId,
        );
        for (const img of variantImgs) {
          try {
            const resolvedUrl = await this.resolveImageUrl(img.url);
            images.push(resolvedUrl);
          } catch (error) {
            this.logger.warn(
              createLogContext(
                this.contextService,
                "ProductEnrichmentService.resolveImageUrl",
                {
                  url: img.url,
                  error: error instanceof Error ? error.message : String(error),
                },
              ),
              "Failed to resolve image URL, skipping",
            );
          }
        }

        // If no variant images, use product images as fallback
        if (images.length === 0) {
          const productImgs = productImagesMap.get(variant.productId) || [];
          for (const img of productImgs) {
            try {
              const resolvedUrl = await this.resolveImageUrl(img.url);
              images.push(resolvedUrl);
            } catch (error) {
              this.logger.warn(
                createLogContext(
                  this.contextService,
                  "ProductEnrichmentService.resolveImageUrl",
                  {
                    url: img.url,
                    error: error instanceof Error ? error.message : String(error),
                  },
                ),
                "Failed to resolve image URL, skipping",
              );
            }
          }
        }

        imagesMap.set(variant.variantId, images);
      }

      return imagesMap;
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "ProductEnrichmentService.fetchVariantImages",
          {
            variants,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to fetch variant images, continuing without images",
      );
      return new Map();
    }
  }

  /**
   * Resolve image URL (S3 key to public URL or return as-is)
   */
  private async resolveImageUrl(url: string): Promise<string> {
    // Check if it's an S3 key (starts with common S3 patterns)
    if (this.isS3Key(url)) {
      try {
        return await this.storageService.getUrl(url);
      } catch (error) {
        // If resolution fails, return original URL
        return url;
      }
    }
    return url;
  }

  /**
   * Check if URL is an S3 key
   */
  private isS3Key(url: string): boolean {
    // Common S3 key patterns: no http/https, or s3:// prefix
    return (
      !url.startsWith("http://") &&
      !url.startsWith("https://") &&
      !url.startsWith("data:")
    );
  }

  /**
   * Determine inventory status based on quantity
   */
  private determineInventoryStatus(
    quantity: number,
  ): "in_stock" | "low_stock" | "out_of_stock" {
    if (quantity <= 0) {
      return "out_of_stock";
    }
    if (quantity <= 10) {
      return "low_stock";
    }
    return "in_stock";
  }

  /**
   * Build variant title from attributes
   */
  private buildVariantTitle(attributes: Record<string, string>): string | null {
    const keys = Object.keys(attributes);
    if (keys.length === 0) {
      return null;
    }

    // Common patterns: "Size / Color" or just the values
    const values = keys
      .sort()
      .map((key) => attributes[key])
      .join(" / ");

    return values || null;
  }
}

