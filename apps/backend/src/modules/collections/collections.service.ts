import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  collections,
  eq,
  gt,
  ilike,
  inArray,
  lt,
  ne,
  or,
  productCollections,
  products,
  productTags,
  productVariants,
  sql,
  tags,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import {
  generatePaginationMetadata,
  normalizePaginationParams,
} from "../../common/utils/pagination.utils";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { AddProductsDto } from "./dto/add-products.dto";
import {
  CollectionRuleDto,
  CollectionRuleField,
  CollectionRuleOperator,
} from "./dto/collection-rule.dto";
import {
  CollectionMatchType,
  CollectionType,
  CreateCollectionDto,
} from "./dto/create-collection.dto";
import { QueryCollectionsDto } from "./dto/query-collections.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

@Injectable()
export class CollectionsService {
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
      let existing: typeof collections.$inferSelect | undefined;
      try {
        const existingResult = await this.db
          .select()
          .from(collections)
          .where(eq(collections.slug, slug))
          .limit(1);
        existing = existingResult[0];
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "CollectionsService.ensureUniqueSlug.selectExisting",
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
   * Create a new collection
   */
  async create(createCollectionDto: CreateCollectionDto) {
    // Generate slug if not provided
    const slug = createCollectionDto.slug
      ? await this.ensureUniqueSlug(createCollectionDto.slug)
      : await this.ensureUniqueSlug(
          this.generateSlug(createCollectionDto.name),
        );

    // Validate rules for automatic collections
    if (
      createCollectionDto.type === "automatic" &&
      (!createCollectionDto.rules || createCollectionDto.rules.length === 0)
    ) {
      throw new BadRequestException(
        "Automatic collections must have at least one rule",
      );
    }

    // Create collection
    let newCollection:
      | {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          imageUrl: string | null;
          type: "manual" | "automatic";
          rules: unknown;
          matchType: "all" | "any" | null;
          position: number | null;
          createdAt: Date;
          updatedAt: Date;
        }
      | undefined;
    try {
      const collectionResult = await this.db
        .insert(collections)
        .values({
          name: createCollectionDto.name,
          slug,
          description: createCollectionDto.description || null,
          imageUrl: createCollectionDto.imageUrl || null,
          type: createCollectionDto.type || "manual",
          rules: createCollectionDto.rules || null,
          matchType: createCollectionDto.matchType || "all",
          position: createCollectionDto.position || 0,
        })
        .returning({
          id: collections.id,
          name: collections.name,
          slug: collections.slug,
          description: collections.description,
          imageUrl: collections.imageUrl,
          type: collections.type,
          rules: collections.rules,
          matchType: collections.matchType,
          position: collections.position,
          createdAt: collections.createdAt,
          updatedAt: collections.updatedAt,
        });
      newCollection = collectionResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CollectionsService.create.insertCollection",
          error,
          { createCollectionDto },
        ),
        "Failed to create collection",
      );
      throw new InternalServerErrorException("Failed to create collection");
    }

    if (!newCollection) {
      throw new InternalServerErrorException("Failed to create collection");
    }

    return {
      ...newCollection,
      type: newCollection.type as CollectionType,
      matchType: newCollection.matchType as CollectionMatchType | null,
      rules: newCollection.rules as CollectionRuleDto[] | null,
      position: newCollection.position ?? undefined,
    };
  }

  /**
   * Get all collections with pagination and search
   */
  async findAll(query: QueryCollectionsDto) {
    const { page, limit, offset } = normalizePaginationParams(
      query.page,
      query.limit,
    );

    // Build where conditions
    const conditions: ReturnType<typeof or | typeof and>[] = [];
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      const searchCondition = or(
        ilike(collections.name, searchPattern),
        ilike(collections.description, searchPattern),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Get total count
    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;
    let totalResult: Array<{ count: number }>;
    try {
      totalResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(collections)
        .where(whereCondition);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CollectionsService.findAll.countCollections",
          error,
          { query },
        ),
        "Failed to count collections",
      );
      throw new InternalServerErrorException("Failed to fetch collections");
    }

    const total = Number(totalResult[0]?.count || 0);

    if (total === 0) {
      const pagination = generatePaginationMetadata(0, page, limit);
      return {
        data: [],
        pagination,
      };
    }

    // Get collections with product count
    let collectionsData: Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      imageUrl: string | null;
      type: string;
      rules: unknown;
      matchType: string | null;
      position: number | null;
      createdAt: Date;
      updatedAt: Date;
      productCount: number;
    }>;
    try {
      collectionsData = await this.db
        .select({
          id: collections.id,
          name: collections.name,
          slug: collections.slug,
          description: collections.description,
          imageUrl: collections.imageUrl,
          type: collections.type,
          rules: collections.rules,
          matchType: collections.matchType,
          position: collections.position,
          createdAt: collections.createdAt,
          updatedAt: collections.updatedAt,
          productCount: sql<number>`count(${productCollections.id})`.as(
            "product_count",
          ),
        })
        .from(collections)
        .leftJoin(
          productCollections,
          eq(collections.id, productCollections.collectionId),
        )
        .where(whereCondition)
        .groupBy(collections.id)
        .orderBy(collections.position, collections.createdAt)
        .limit(limit)
        .offset(offset);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CollectionsService.findAll.selectCollections",
          error,
          { query },
        ),
        "Failed to fetch collections",
      );
      throw new InternalServerErrorException("Failed to fetch collections");
    }

    const pagination = generatePaginationMetadata(total, page, limit);

    return {
      data: collectionsData.map((c) => ({
        ...c,
        productCount: Number(c.productCount) || 0,
      })),
      pagination,
    };
  }

  /**
   * Get collection by ID
   */
  async findOne(id: string) {
    const [collection] = await this.db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        imageUrl: collections.imageUrl,
        type: collections.type,
        rules: collections.rules,
        matchType: collections.matchType,
        position: collections.position,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
      })
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    // Get product count
    const productCountResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productCollections)
      .where(eq(productCollections.collectionId, id));

    const productCount = Number(productCountResult[0]?.count || 0);

    return {
      ...collection,
      type: collection.type as CollectionType,
      matchType: collection.matchType as CollectionMatchType | null,
      rules: collection.rules as CollectionRuleDto[] | null,
      position: collection.position ?? undefined,
      productCount,
    };
  }

  /**
   * Get collection by slug
   */
  async findBySlug(slug: string) {
    const [collection] = await this.db
      .select()
      .from(collections)
      .where(eq(collections.slug, slug))
      .limit(1);

    if (!collection) {
      throw new NotFoundException(`Collection with slug '${slug}' not found`);
    }

    // Get product count
    const productCountResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productCollections)
      .where(eq(productCollections.collectionId, collection.id));

    const productCount = Number(productCountResult[0]?.count || 0);

    return {
      ...collection,
      productCount,
    };
  }

  /**
   * Update a collection
   */
  async update(id: string, updateCollectionDto: UpdateCollectionDto) {
    // Check if collection exists
    const [existing] = await this.db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    // Generate slug if name changed and slug not provided
    let slug = updateCollectionDto.slug;
    if (updateCollectionDto.name && !slug) {
      slug = await this.ensureUniqueSlug(
        this.generateSlug(updateCollectionDto.name),
        id,
      );
    } else if (slug) {
      slug = await this.ensureUniqueSlug(slug, id);
    }

    // Validate rules for automatic collections
    if (
      updateCollectionDto.type === "automatic" &&
      (!updateCollectionDto.rules || updateCollectionDto.rules.length === 0)
    ) {
      throw new BadRequestException(
        "Automatic collections must have at least one rule",
      );
    }

    // Update collection
    const updateData: {
      name?: string;
      slug?: string;
      description?: string | null;
      imageUrl?: string | null;
      type?: "manual" | "automatic";
      rules?: Array<{
        field: string;
        operator: string;
        value: string | number;
      }> | null;
      matchType?: "all" | "any";
      position?: number;
    } = {};
    if (updateCollectionDto.name !== undefined)
      updateData.name = updateCollectionDto.name;
    if (slug !== undefined) updateData.slug = slug;
    if (updateCollectionDto.description !== undefined)
      updateData.description = updateCollectionDto.description || null;
    if (updateCollectionDto.imageUrl !== undefined)
      updateData.imageUrl = updateCollectionDto.imageUrl || null;
    if (updateCollectionDto.type !== undefined)
      updateData.type = updateCollectionDto.type;
    if (updateCollectionDto.rules !== undefined)
      updateData.rules = updateCollectionDto.rules || null;
    if (updateCollectionDto.matchType !== undefined)
      updateData.matchType = updateCollectionDto.matchType;
    if (updateCollectionDto.position !== undefined)
      updateData.position = updateCollectionDto.position;

    const [updated] = await this.db
      .update(collections)
      .set(updateData)
      .where(eq(collections.id, id))
      .returning({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        imageUrl: collections.imageUrl,
        type: collections.type,
        rules: collections.rules,
        matchType: collections.matchType,
        position: collections.position,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
      });

    return {
      ...updated,
      type: updated.type as CollectionType,
      matchType: updated.matchType as CollectionMatchType | null,
      rules: updated.rules as CollectionRuleDto[] | null,
      position: updated.position ?? undefined,
    };
  }

  /**
   * Delete a collection
   */
  async remove(id: string) {
    // Check if collection exists
    const [existing] = await this.db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    // Delete collection (cascade will remove product associations)
    await this.db.delete(collections).where(eq(collections.id, id));

    return { message: "Collection deleted successfully" };
  }

  /**
   * Evaluate rules and get matching product IDs for automatic collections
   */
  private async evaluateRules(
    rules: CollectionRuleDto[],
    matchType: "all" | "any",
  ): Promise<string[]> {
    if (!rules || rules.length === 0) {
      return [];
    }

    // Build conditions for each rule
    const ruleConditions: ReturnType<typeof and | typeof or>[] = [];

    for (const rule of rules) {
      let condition: ReturnType<typeof and | typeof or> | null = null;

      switch (rule.field) {
        case CollectionRuleField.PRICE:
          switch (rule.operator) {
            case CollectionRuleOperator.EQUALS:
              condition = eq(products.price, Number(rule.value));
              break;
            case CollectionRuleOperator.NOT_EQUALS:
              condition = ne(products.price, Number(rule.value));
              break;
            case CollectionRuleOperator.LESS_THAN:
              condition = lt(products.price, Number(rule.value));
              break;
            case CollectionRuleOperator.GREATER_THAN:
              condition = gt(products.price, Number(rule.value));
              break;
            default:
              throw new BadRequestException(
                `Invalid operator ${rule.operator} for price field`,
              );
          }
          break;

        case CollectionRuleField.TITLE:
          switch (rule.operator) {
            case CollectionRuleOperator.EQUALS:
              condition = eq(products.title, String(rule.value));
              break;
            case CollectionRuleOperator.NOT_EQUALS:
              condition = ne(products.title, String(rule.value));
              break;
            case CollectionRuleOperator.CONTAINS:
              condition = ilike(products.title, `%${String(rule.value)}%`);
              break;
            default:
              throw new BadRequestException(
                `Invalid operator ${rule.operator} for title field`,
              );
          }
          break;

        case CollectionRuleField.STATUS: {
          const statusValue = String(rule.value) as
            | "draft"
            | "active"
            | "archived";
          if (!["draft", "active", "archived"].includes(statusValue)) {
            throw new BadRequestException(
              `Invalid status value: ${rule.value}. Must be one of: draft, active, archived`,
            );
          }
          switch (rule.operator) {
            case CollectionRuleOperator.EQUALS:
              condition = eq(products.status, statusValue);
              break;
            case CollectionRuleOperator.NOT_EQUALS:
              condition = ne(products.status, statusValue);
              break;
            default:
              throw new BadRequestException(
                `Invalid operator ${rule.operator} for status field`,
              );
          }
          break;
        }

        case CollectionRuleField.CATEGORY:
          switch (rule.operator) {
            case CollectionRuleOperator.EQUALS:
              condition = eq(products.categoryId, String(rule.value));
              break;
            case CollectionRuleOperator.NOT_EQUALS:
              condition = ne(products.categoryId, String(rule.value));
              break;
            default:
              throw new BadRequestException(
                `Invalid operator ${rule.operator} for category field`,
              );
          }
          break;

        case CollectionRuleField.TAGS: {
          // For tags, we need to check productTags junction table
          const tagProducts = await this.db
            .select({ productId: productTags.productId })
            .from(productTags)
            .innerJoin(tags, eq(productTags.tagId, tags.id))
            .where(
              rule.operator === CollectionRuleOperator.EQUALS
                ? eq(tags.name, String(rule.value))
                : ne(tags.name, String(rule.value)),
            );
          const tagProductIds = tagProducts.map((tp) => tp.productId);
          if (tagProductIds.length === 0) {
            return [];
          }
          condition = inArray(products.id, tagProductIds);
          break;
        }

        case CollectionRuleField.INVENTORY: {
          // For inventory, sum up variant inventories per product
          const inventoryValue = Number(rule.value);
          let inventoryProducts: { productId: string }[] = [];

          if (rule.operator === CollectionRuleOperator.EQUALS) {
            inventoryProducts = await this.db
              .select({ productId: productVariants.productId })
              .from(productVariants)
              .groupBy(productVariants.productId)
              .having(
                sql`sum(${productVariants.inventory}) = ${inventoryValue}`,
              );
          } else if (rule.operator === CollectionRuleOperator.NOT_EQUALS) {
            inventoryProducts = await this.db
              .select({ productId: productVariants.productId })
              .from(productVariants)
              .groupBy(productVariants.productId)
              .having(
                sql`sum(${productVariants.inventory}) != ${inventoryValue}`,
              );
          } else if (rule.operator === CollectionRuleOperator.GREATER_THAN) {
            inventoryProducts = await this.db
              .select({ productId: productVariants.productId })
              .from(productVariants)
              .groupBy(productVariants.productId)
              .having(
                sql`sum(${productVariants.inventory}) > ${inventoryValue}`,
              );
          } else if (rule.operator === CollectionRuleOperator.LESS_THAN) {
            inventoryProducts = await this.db
              .select({ productId: productVariants.productId })
              .from(productVariants)
              .groupBy(productVariants.productId)
              .having(
                sql`sum(${productVariants.inventory}) < ${inventoryValue}`,
              );
          } else {
            throw new BadRequestException(
              `Invalid operator ${rule.operator} for inventory field`,
            );
          }

          const inventoryProductIds = inventoryProducts.map(
            (ip) => ip.productId,
          );
          if (inventoryProductIds.length === 0) {
            return [];
          }
          condition = inArray(products.id, inventoryProductIds);
          break;
        }

        default:
          throw new BadRequestException(`Invalid field: ${rule.field}`);
      }

      if (condition) {
        ruleConditions.push(condition);
      }
    }

    if (ruleConditions.length === 0) {
      return [];
    }

    // Combine conditions based on matchType
    const whereCondition =
      matchType === "all" ? and(...ruleConditions) : or(...ruleConditions);

    if (!whereCondition) {
      return [];
    }

    // Get matching products
    const matchingProducts = await this.db
      .select({ id: products.id })
      .from(products)
      .where(whereCondition);

    return matchingProducts.map((p) => p.id);
  }

  /**
   * Get products in a collection (handles both manual and automatic)
   */
  async getProducts(collectionId: string) {
    // Check if collection exists
    const [collection] = await this.db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        imageUrl: collections.imageUrl,
        type: collections.type,
        rules: collections.rules,
        matchType: collections.matchType,
        position: collections.position,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
      })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (!collection) {
      throw new NotFoundException(
        `Collection with ID ${collectionId} not found`,
      );
    }

    // For automatic collections, evaluate rules
    if (collection.type === "automatic" && collection.rules) {
      const matchingProductIds = await this.evaluateRules(
        collection.rules as CollectionRuleDto[],
        (collection.matchType as "all" | "any") || "all",
      );

      if (matchingProductIds.length === 0) {
        return [];
      }

      const collectionProducts = await this.db
        .select({
          id: products.id,
          title: products.title,
          price: products.price,
          status: products.status,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .where(inArray(products.id, matchingProductIds))
        .orderBy(products.createdAt);

      return collectionProducts;
    }

    // For manual collections, get products from productCollections
    const collectionProducts = await this.db
      .select({
        id: products.id,
        title: products.title,
        price: products.price,
        status: products.status,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(productCollections)
      .innerJoin(products, eq(productCollections.productId, products.id))
      .where(eq(productCollections.collectionId, collectionId))
      .orderBy(products.createdAt);

    return collectionProducts;
  }

  /**
   * Preview automatic collection (get count of matching products)
   */
  async preview(id: string) {
    const [collection] = await this.db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        imageUrl: collections.imageUrl,
        type: collections.type,
        rules: collections.rules,
        matchType: collections.matchType,
        position: collections.position,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
      })
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    if (collection.type !== "automatic") {
      throw new BadRequestException(
        "Preview is only available for automatic collections",
      );
    }

    if (!collection.rules || collection.rules.length === 0) {
      return { count: 0 };
    }

    const matchingProductIds = await this.evaluateRules(
      collection.rules as CollectionRuleDto[],
      (collection.matchType as "all" | "any") || "all",
    );

    return { count: matchingProductIds.length };
  }

  /**
   * Add products to a collection
   */
  async addProducts(collectionId: string, addProductsDto: AddProductsDto) {
    // Check if collection exists
    const [collection] = await this.db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (!collection) {
      throw new NotFoundException(
        `Collection with ID ${collectionId} not found`,
      );
    }

    // Validate all products exist
    const existingProducts = await this.db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, addProductsDto.productIds));

    const existingProductIds = new Set(existingProducts.map((p) => p.id));
    const missingProductIds = addProductsDto.productIds.filter(
      (id) => !existingProductIds.has(id),
    );

    if (missingProductIds.length > 0) {
      throw new BadRequestException(
        `Products not found: ${missingProductIds.join(", ")}`,
      );
    }

    // Check which products are already in collection
    const existingAssociations = await this.db
      .select({ productId: productCollections.productId })
      .from(productCollections)
      .where(eq(productCollections.collectionId, collectionId));

    const existingAssociationIds = new Set(
      existingAssociations.map((a) => a.productId),
    );

    // Filter out products already in collection
    const newProductIds = addProductsDto.productIds.filter(
      (id) => !existingAssociationIds.has(id),
    );

    if (newProductIds.length === 0) {
      return {
        message: "All products are already in the collection",
        added: 0,
        skipped: addProductsDto.productIds.length,
      };
    }

    // Add products to collection
    await this.db.insert(productCollections).values(
      newProductIds.map((productId) => ({
        collectionId,
        productId,
      })),
    );

    return {
      message: `Added ${newProductIds.length} product(s) to collection`,
      added: newProductIds.length,
      skipped: addProductsDto.productIds.length - newProductIds.length,
    };
  }

  /**
   * Remove a product from a collection
   */
  async removeProduct(collectionId: string, productId: string) {
    // Check if collection exists
    const [collection] = await this.db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (!collection) {
      throw new NotFoundException(
        `Collection with ID ${collectionId} not found`,
      );
    }

    // Check if product exists
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Remove product from collection
    await this.db
      .delete(productCollections)
      .where(
        sql`${productCollections.collectionId} = ${collectionId} AND ${productCollections.productId} = ${productId}`,
      );

    return { message: "Product removed from collection successfully" };
  }
}
