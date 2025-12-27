import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { categories, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}
  /**
   * Generate a slug from a name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
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
      let existing: typeof categories.$inferSelect | undefined;
      try {
        const existingResult = await this.db
          .select()
          .from(categories)
          .where(eq(categories.slug, slug))
          .limit(1);
        existing = existingResult[0];
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "CategoriesService.ensureUniqueSlug.selectExisting",
            error,
            { slug },
          ),
          "Failed to check slug uniqueness",
        );
        throw new InternalServerErrorException("Failed to validate slug");
      }

      if (!existing || existing.id === excludeId) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Create a new category
   */
  async create(createCategoryDto: CreateCategoryDto) {
    // Validate parent exists if provided
    if (createCategoryDto.parentId) {
      let parent: typeof categories.$inferSelect | undefined;
      try {
        const parentResult = await this.db
          .select()
          .from(categories)
          .where(eq(categories.id, createCategoryDto.parentId))
          .limit(1);
        parent = parentResult[0];
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "CategoriesService.create.selectParent",
            error,
            { parentId: createCategoryDto.parentId },
          ),
          "Failed to validate parent category",
        );
        throw new BadRequestException(
          `Parent category with ID ${createCategoryDto.parentId} not found`,
        );
      }

      if (!parent) {
        throw new BadRequestException(
          `Parent category with ID ${createCategoryDto.parentId} not found`,
        );
      }
    }

    // Generate slug if not provided
    const slug = createCategoryDto.slug
      ? await this.ensureUniqueSlug(createCategoryDto.slug)
      : await this.ensureUniqueSlug(this.generateSlug(createCategoryDto.name));

    // Create category
    let newCategory: typeof categories.$inferSelect | undefined;
    try {
      const categoryResult = await this.db
        .insert(categories)
        .values({
          name: createCategoryDto.name,
          slug,
          parentId: createCategoryDto.parentId || null,
          description: createCategoryDto.description || null,
          imageUrl: createCategoryDto.imageUrl || null,
        })
        .returning();
      newCategory = categoryResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CategoriesService.create.insertCategory",
          error,
          { createCategoryDto },
        ),
        "Failed to create category",
      );
      throw new InternalServerErrorException("Failed to create category");
    }

    if (!newCategory) {
      throw new InternalServerErrorException("Failed to create category");
    }

    return newCategory;
  }

  /**
   * Get all categories
   */
  async findAll() {
    try {
      return await this.db.select().from(categories);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CategoriesService.findAll.selectCategories",
          error,
          {},
        ),
        "Failed to fetch categories",
      );
      throw new InternalServerErrorException("Failed to fetch categories");
    }
  }

  /**
   * Get category tree (hierarchical structure)
   */
  async findTree() {
    let allCategories: Array<typeof categories.$inferSelect>;
    try {
      allCategories = await this.db.select().from(categories);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CategoriesService.findTree.selectCategories",
          error,
          {},
        ),
        "Failed to fetch categories for tree",
      );
      throw new InternalServerErrorException("Failed to fetch category tree");
    }

    // Type for category with children
    type CategoryWithChildren = (typeof allCategories)[0] & {
      children: CategoryWithChildren[];
    };

    // Build a map of categories by ID
    const categoryMap = new Map<string, CategoryWithChildren>(
      allCategories.map((cat) => [
        cat.id,
        { ...cat, children: [] as CategoryWithChildren[] },
      ]),
    );

    // Build tree structure
    const rootCategories: CategoryWithChildren[] = [];

    for (const category of allCategories) {
      const categoryWithChildren = categoryMap.get(category.id);
      if (!categoryWithChildren) continue;

      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        } else {
          // Parent not found, treat as root
          rootCategories.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    }

    return rootCategories;
  }

  /**
   * Get category by ID
   */
  async findOne(id: string) {
    let category: typeof categories.$inferSelect | undefined;
    try {
      const categoryResult = await this.db
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1);
      category = categoryResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CategoriesService.findOne.selectCategory",
          error,
          { id },
        ),
        "Failed to fetch category",
      );
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  /**
   * Get category by slug
   */
  async findBySlug(slug: string) {
    let category: typeof categories.$inferSelect | undefined;
    try {
      const categoryResult = await this.db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
      category = categoryResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CategoriesService.findBySlug.selectCategory",
          error,
          { slug },
        ),
        "Failed to fetch category by slug",
      );
      throw new NotFoundException(`Category with slug '${slug}' not found`);
    }

    if (!category) {
      throw new NotFoundException(`Category with slug '${slug}' not found`);
    }

    return category;
  }

  /**
   * Update a category
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    // Check if category exists
    let existing: typeof categories.$inferSelect | undefined;
    try {
      const existingResult = await this.db
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1);
      existing = existingResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CategoriesService.update.selectExisting",
          error,
          { id },
        ),
        "Failed to fetch category",
      );
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Validate parent exists if provided
    if (updateCategoryDto.parentId) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException("Category cannot be its own parent");
      }

      let parent: typeof categories.$inferSelect | undefined;
      try {
        const parentResult = await this.db
          .select()
          .from(categories)
          .where(eq(categories.id, updateCategoryDto.parentId))
          .limit(1);
        parent = parentResult[0];
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "CategoriesService.update.selectParent",
            error,
            { parentId: updateCategoryDto.parentId },
          ),
          "Failed to validate parent category",
        );
        throw new BadRequestException(
          `Parent category with ID ${updateCategoryDto.parentId} not found`,
        );
      }

      if (!parent) {
        throw new BadRequestException(
          `Parent category with ID ${updateCategoryDto.parentId} not found`,
        );
      }

      // Check for circular reference (parent cannot be a descendant)
      const descendants = await this.getDescendants(id);
      if (descendants.some((d) => d.id === updateCategoryDto.parentId)) {
        throw new BadRequestException(
          "Cannot set parent: would create circular reference",
        );
      }
    }

    // Generate slug if name changed and slug not provided
    let slug = updateCategoryDto.slug;
    if (updateCategoryDto.name && !slug) {
      slug = await this.ensureUniqueSlug(
        this.generateSlug(updateCategoryDto.name),
        id,
      );
    } else if (slug) {
      slug = await this.ensureUniqueSlug(slug, id);
    }

    // Update category
    const updateData: Partial<typeof categories.$inferInsert> = {};
    if (updateCategoryDto.name !== undefined)
      updateData.name = updateCategoryDto.name;
    if (slug !== undefined) updateData.slug = slug;
    if (updateCategoryDto.parentId !== undefined)
      updateData.parentId = updateCategoryDto.parentId || null;
    if (updateCategoryDto.description !== undefined)
      updateData.description = updateCategoryDto.description || null;
    if (updateCategoryDto.imageUrl !== undefined)
      updateData.imageUrl = updateCategoryDto.imageUrl || null;

    const [updated] = await this.db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete a category
   */
  async remove(id: string) {
    // Check if category exists
    const [existing] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Check if category has children
    const [child] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.parentId, id))
      .limit(1);

    if (child) {
      throw new BadRequestException(
        "Cannot delete category with child categories. Please delete or reassign children first.",
      );
    }

    // Delete category
    await this.db.delete(categories).where(eq(categories.id, id));

    return { message: "Category deleted successfully" };
  }

  /**
   * Get all descendants of a category (for circular reference check)
   */
  private async getDescendants(
    categoryId: string,
  ): Promise<(typeof categories.$inferSelect)[]> {
    const descendants: (typeof categories.$inferSelect)[] = [];
    const queue = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) break;
      const children = await this.db
        .select()
        .from(categories)
        .where(eq(categories.parentId, currentId));

      for (const child of children) {
        descendants.push(child);
        queue.push(child.id);
      }
    }

    return descendants;
  }
}
