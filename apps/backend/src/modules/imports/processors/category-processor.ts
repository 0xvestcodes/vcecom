import { Inject, Injectable } from "@nestjs/common";
import { categories, eq, stores } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { StoreContextService } from "../../../common/store-context/store-context.service";
import { generateSlug } from "../../../common/utils/slug.utils";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { CategoryValidator } from "../validators/category-validator";

export interface ProcessResult {
  success: boolean;
  categoryId?: string;
  error?: string;
}

@Injectable()
export class CategoryProcessor {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly validator: CategoryValidator,
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
   * Process a single category import row
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

      // Validate parent exists if provided
      if (data.parentId) {
        const [parent] = await this.db
          .select()
          .from(categories)
          .where(eq(categories.id, data.parentId))
          .limit(1);

        if (!parent) {
          return {
            success: false,
            error: `Parent category with ID ${data.parentId} not found`,
          };
        }
      }

      // Generate slug if not provided
      let slug = data.slug;
      if (!slug) {
        slug = generateSlug(data.name);
      }

      // Ensure slug uniqueness
      slug = await this.ensureUniqueSlug(slug);

      // Check if category with this slug already exists
      const [existing] = await this.db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);

      if (existing) {
        if (options?.updateExisting) {
          // Update existing category
          const [updated] = await this.db
            .update(categories)
            .set({
              name: data.name,
              slug,
              parentId: data.parentId || null,
              description: data.description || null,
              imageUrl: data.imageUrl || null,
              updatedAt: new Date(),
            })
            .where(eq(categories.id, existing.id))
            .returning();

          return {
            success: true,
            categoryId: updated.id,
          };
        } else {
          return {
            success: false,
            error: `Category with slug "${slug}" already exists`,
          };
        }
      }

      // Create new category
      const storeId = await this.getDefaultStoreId();
      const [newCategory] = await this.db
        .insert(categories)
        .values({
          name: data.name,
          storeId,
          slug,
          parentId: data.parentId || null,
          description: data.description || null,
          imageUrl: data.imageUrl || null,
        })
        .returning();

      return {
        success: true,
        categoryId: newCategory.id,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "process", error, { row }),
        "Failed to process category import row",
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Ensure slug is unique by appending a number if needed
   */
  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const [existing] = await this.db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);

      if (!existing) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
