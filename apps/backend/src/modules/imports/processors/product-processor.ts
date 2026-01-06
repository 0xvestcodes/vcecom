import { Inject, Injectable } from "@nestjs/common";
import { categories, eq, products, stores } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { StoreContextService } from "../../../common/store-context/store-context.service";
import {
  generateSlug,
  generateUniqueSlug,
} from "../../../common/utils/slug.utils";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { ProductValidator } from "../validators/product-validator";

export interface ProcessResult {
  success: boolean;
  productId?: string;
  error?: string;
}

@Injectable()
export class ProductProcessor {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly validator: ProductValidator,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly storeContextService: StoreContextService,
  ) {}

  /**
   * Get default store ID helper
   */
  private async getDefaultStoreId(): Promise<string> {
    const contextStoreId = this.storeContextService.getStoreId();
    if (contextStoreId) {
      return contextStoreId;
    }

    const [defaultStore] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.isDefault, true))
      .limit(1);

    if (defaultStore) {
      return defaultStore.id;
    }

    const [firstStore] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .limit(1);
    if (firstStore) {
      return firstStore.id;
    }

    throw new Error("No store found");
  }

  /**
   * Process a single product import row
   */
  async process(
    row: Record<string, string>,
    options?: {
      updateExisting?: boolean;
      skipErrors?: boolean;
    },
  ): Promise<ProcessResult> {
    try {
      // Validate row data
      const validation = this.validator.validate(row);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.map((e) => e.errorMessage).join("; "),
        };
      }

      if (!validation.data) {
        return {
          success: false,
          error: "Validation data is missing",
        };
      }

      const data = validation.data;

      // Validate category exists if provided
      if (data.categoryId) {
        const [category] = await this.db
          .select()
          .from(categories)
          .where(eq(categories.id, data.categoryId))
          .limit(1);

        if (!category) {
          return {
            success: false,
            error: `Category with ID ${data.categoryId} not found`,
          };
        }
      }

      // Generate slug if not provided
      let slug = data.slug;
      if (!slug) {
        slug = generateSlug(data.title);
        // Ensure uniqueness
        const existingSlugs = await this.db
          .select({ slug: products.slug })
          .from(products)
          .where(eq(products.slug, slug))
          .limit(10);
        const slugList = existingSlugs.map((p) => p.slug || "").filter(Boolean);
        slug = generateUniqueSlug(slug, slugList);
      } else {
        // Check if slug already exists
        const [existing] = await this.db
          .select()
          .from(products)
          .where(eq(products.slug, slug))
          .limit(1);

        if (existing) {
          if (options?.updateExisting) {
            // Update existing product
            const [updated] = await this.db
              .update(products)
              .set({
                title: data.title,
                description: data.description || null,
                price: data.price,
                gstRate: data.gstRate ?? 0,
                pricingType: data.pricingType || "exclusive",
                hsnCode: data.hsnCode || null,
                status: data.status || "draft",
                categoryId: data.categoryId || null,
                updatedAt: new Date(),
              })
              .where(eq(products.id, existing.id))
              .returning();

            return {
              success: true,
              productId: updated.id,
            };
          } else {
            return {
              success: false,
              error: `Product with slug "${slug}" already exists`,
            };
          }
        }
      }

      // Create new product
      const storeId = await this.getDefaultStoreId();
      const [newProduct] = await this.db
        .insert(products)
        .values({
          title: data.title,
          storeId,
          description: data.description || null,
          price: data.price,
          gstRate: data.gstRate ?? 0,
          pricingType: data.pricingType || "exclusive",
          hsnCode: data.hsnCode || null,
          slug: slug || null,
          status: data.status || "draft",
          categoryId: data.categoryId || null,
        })
        .returning();

      return {
        success: true,
        productId: newProduct.id,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "process", error, { row }),
        "Failed to process product import row",
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
