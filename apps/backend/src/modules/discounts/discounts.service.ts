// External libraries
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  desc,
  discountCategories,
  discountCollections,
  discountExclusions,
  discountGetCategories,
  discountGetCollections,
  discountGetProducts,
  discountGetTags,
  discountProducts,
  discounts,
  discountTags,
  discountTieredRules,
  discountUsages,
  eq,
  gte,
  lte,
  or,
  sql,
} from "@vcecom/db";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";

// Internal modules - Redis stores
import { DiscountRuleStore } from "../redis-store/stores/discount-rule-store";
import { EligibilityStore } from "../redis-store/stores/eligibility-store";

// Relative imports - DTOs
import {
  CreateDiscountDto,
  DiscountApplicationType,
  DiscountAppliesTo,
  DiscountScope,
  DiscountType,
  DiscountValueType,
} from "./dto/create-discount.dto";
import { DiscountResponseDto } from "./dto/discount-response.dto";
import { UpdateDiscountDto } from "./dto/update-discount.dto";

// Relative imports - Services and helpers
import {
  isDiscountAlreadyInList,
  passesEligibilityConstraints,
} from "./services/discount-eligibility.helper";
import { DiscountInvalidationService } from "./services/discount-invalidation.service";
import { DiscountProfiler } from "./services/discount-profiler.service";
import { HotReloadWatcher } from "./services/hot-reload-watcher.service";
import { RuleChangeTracker } from "./services/rule-change-tracker.service";
import { RulesetRebuilder } from "./services/ruleset-rebuilder.service";

@Injectable()
export class DiscountsService {
  constructor(
    readonly _discountRuleStore: DiscountRuleStore,
    private readonly eligibilityStore: EligibilityStore,
    private readonly invalidationService: DiscountInvalidationService,
    private readonly ruleChangeTracker: RuleChangeTracker,
    private readonly hotReloadWatcher: HotReloadWatcher,
    @Inject(forwardRef(() => RulesetRebuilder))
    private readonly rulesetRebuilder: RulesetRebuilder,
    private readonly profiler: DiscountProfiler,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  // ============================================================================
  // Public API Methods - CRUD Operations
  // ============================================================================

  /**
   * Create a new discount
   */
  async create(
    createDiscountDto: CreateDiscountDto,
  ): Promise<DiscountResponseDto> {
    // Validate discount code uniqueness
    const [existing] = await this.db
      .select()
      .from(discounts)
      .where(eq(discounts.code, createDiscountDto.code))
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        `Discount code '${createDiscountDto.code}' already exists`,
      );
    }

    // Validate dates
    const startDate = new Date(createDiscountDto.startDate);
    const endDate = createDiscountDto.endDate
      ? new Date(createDiscountDto.endDate)
      : null;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException("End date must be after start date");
    }

    // Validate value based on type
    if (
      createDiscountDto.valueType === "PERCENTAGE" &&
      createDiscountDto.value > 100
    ) {
      throw new BadRequestException("Percentage discount cannot exceed 100%");
    }

    // Create discount
    const [newDiscount] = await this.db
      .insert(discounts)
      .values({
        code: createDiscountDto.code,
        name: createDiscountDto.name,
        description: createDiscountDto.description || null,
        type: createDiscountDto.type,
        applicationType: createDiscountDto.applicationType || "MANUAL",
        valueType: createDiscountDto.valueType,
        value: createDiscountDto.value,
        minOrderAmount: createDiscountDto.minOrderAmount || null,
        maxDiscountAmount: createDiscountDto.maxDiscountAmount || null,
        minQuantity: createDiscountDto.minQuantity || null,
        customerGroupIds: createDiscountDto.customerGroupIds || null,
        scope: createDiscountDto.scope || "PRODUCT",
        appliesTo: createDiscountDto.appliesTo || "SUBTOTAL",
        priority: createDiscountDto.priority || 1,
        canStack: createDiscountDto.canStack ?? true,
        mutuallyExclusive: createDiscountDto.mutuallyExclusive ?? false,
        startDate,
        endDate,
        isActive: createDiscountDto.isActive ?? true,
        usageLimit: createDiscountDto.usageLimit || null,
        usageCount: 0,
        perUserLimit: createDiscountDto.perUserLimit || null,
      })
      .returning();

    // Create relationships for product-level discounts
    if (
      createDiscountDto.type === DiscountType.FIXED_AMOUNT ||
      createDiscountDto.type === DiscountType.PERCENTAGE ||
      createDiscountDto.type === DiscountType.TIERED
    ) {
      await this.createStandardDiscountRelations(
        newDiscount.id,
        createDiscountDto,
      );
    }

    // Create relationships for BUY_X_GET_Y type
    if (createDiscountDto.type === DiscountType.BUY_X_GET_Y) {
      await this.createBuyGetDiscountRelations(
        newDiscount.id,
        createDiscountDto,
      );
    }

    // Create tiered rules for TIERED type
    if (
      createDiscountDto.type === DiscountType.TIERED &&
      createDiscountDto.tieredRules
    ) {
      await this.createTieredRules(
        newDiscount.id,
        createDiscountDto.tieredRules,
      );
    }

    // Create exclusions
    if (
      createDiscountDto.excludedDiscountIds &&
      createDiscountDto.excludedDiscountIds.length > 0
    ) {
      await this.createDiscountExclusions(
        newDiscount.id,
        createDiscountDto.excludedDiscountIds,
      );
    }

    const enriched = await this.enrichDiscountWithRelations(newDiscount.id);

    // Track rule change
    try {
      await this.ruleChangeTracker.trackRuleCreated(enriched);
    } catch (error) {
      // Log but don't throw - audit logging failure shouldn't break discount creation
      console.warn("Failed to track discount rule creation:", error);
    }

    // Invalidate cache on discount creation
    try {
      await this.invalidationService.invalidateDiscount(enriched.id);
    } catch (error) {
      // Log but don't throw - cache invalidation failure shouldn't break discount creation
      console.warn("Failed to invalidate discount cache:", error);
    }

    return enriched;
  }

  /**
   * Get all discounts with pagination
   */
  async findAll(page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;

      const allDiscounts = await this.db
        .select()
        .from(discounts)
        .orderBy(desc(discounts.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count using COUNT(*) for performance
      const countResult = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(discounts);
      const total = Number(countResult[0]?.count || 0);
      const totalPages = Math.ceil(total / limit);

      const enrichedDiscounts = await Promise.all(
        allDiscounts.map((discount) =>
          this.enrichDiscountWithRelations(discount.id),
        ),
      );

      return {
        data: enrichedDiscounts,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      console.error("Error in findAll:", error);
      throw error;
    }
  }

  /**
   * Get all discounts without pagination (for cache hydration)
   */
  async findAllUnpaginated(): Promise<DiscountResponseDto[]> {
    const allDiscounts = await this.db
      .select()
      .from(discounts)
      .orderBy(desc(discounts.createdAt));

    const enrichedDiscounts = await Promise.all(
      allDiscounts.map((discount) =>
        this.enrichDiscountWithRelations(discount.id),
      ),
    );

    return enrichedDiscounts;
  }

  /**
   * Get discount by ID
   */
  async findOne(id: string): Promise<DiscountResponseDto> {
    const [discount] = await this.db
      .select()
      .from(discounts)
      .where(eq(discounts.id, id))
      .limit(1);

    if (!discount) {
      throw new NotFoundException(`Discount with ID ${id} not found`);
    }

    return this.enrichDiscountWithRelations(discount.id);
  }

  /**
   * Get discount by code
   */
  async findByCode(code: string): Promise<DiscountResponseDto> {
    const [discount] = await this.db
      .select()
      .from(discounts)
      .where(eq(discounts.code, code))
      .limit(1);

    if (!discount) {
      throw new NotFoundException(`Discount with code '${code}' not found`);
    }

    return this.enrichDiscountWithRelations(discount.id);
  }

  /**
   * Update discount
   */
  async update(
    id: string,
    updateDiscountDto: UpdateDiscountDto,
  ): Promise<DiscountResponseDto> {
    const [existing] = await this.db
      .select()
      .from(discounts)
      .where(eq(discounts.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Discount with ID ${id} not found`);
    }

    // Validate code uniqueness if code is being updated
    if (updateDiscountDto.code && updateDiscountDto.code !== existing.code) {
      const [codeExists] = await this.db
        .select()
        .from(discounts)
        .where(eq(discounts.code, updateDiscountDto.code))
        .limit(1);

      if (codeExists) {
        throw new BadRequestException(
          `Discount code '${updateDiscountDto.code}' already exists`,
        );
      }
    }

    // Validate dates
    const startDate = updateDiscountDto.startDate
      ? new Date(updateDiscountDto.startDate)
      : existing.startDate;
    const endDate = updateDiscountDto.endDate
      ? new Date(updateDiscountDto.endDate)
      : existing.endDate;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException("End date must be after start date");
    }

    // Build update data
    const updateData: Partial<typeof discounts.$inferInsert> = {};
    if (updateDiscountDto.code !== undefined)
      updateData.code = updateDiscountDto.code;
    if (updateDiscountDto.name !== undefined)
      updateData.name = updateDiscountDto.name;
    if (updateDiscountDto.description !== undefined)
      updateData.description = updateDiscountDto.description || null;
    if (updateDiscountDto.type !== undefined)
      updateData.type = updateDiscountDto.type;
    if (updateDiscountDto.applicationType !== undefined)
      updateData.applicationType = updateDiscountDto.applicationType;
    if (updateDiscountDto.valueType !== undefined)
      updateData.valueType = updateDiscountDto.valueType;
    if (updateDiscountDto.value !== undefined)
      updateData.value = updateDiscountDto.value;
    if (updateDiscountDto.minOrderAmount !== undefined)
      updateData.minOrderAmount = updateDiscountDto.minOrderAmount || null;
    if (updateDiscountDto.maxDiscountAmount !== undefined)
      updateData.maxDiscountAmount =
        updateDiscountDto.maxDiscountAmount || null;
    if (updateDiscountDto.scope !== undefined)
      updateData.scope = updateDiscountDto.scope;
    if (updateDiscountDto.startDate !== undefined)
      updateData.startDate = startDate;
    if (updateDiscountDto.endDate !== undefined) updateData.endDate = endDate;
    if (updateDiscountDto.isActive !== undefined)
      updateData.isActive = updateDiscountDto.isActive;
    if (updateDiscountDto.usageLimit !== undefined)
      updateData.usageLimit = updateDiscountDto.usageLimit || null;
    if (updateDiscountDto.perUserLimit !== undefined)
      updateData.perUserLimit = updateDiscountDto.perUserLimit || null;

    // Update discount
    const [updated] = await this.db
      .update(discounts)
      .set(updateData)
      .where(eq(discounts.id, id))
      .returning();

    // Update relationships if type changed or IDs provided
    if (
      updateDiscountDto.type !== undefined ||
      updateDiscountDto.productIds !== undefined ||
      updateDiscountDto.categoryIds !== undefined ||
      updateDiscountDto.collectionIds !== undefined ||
      updateDiscountDto.tagIds !== undefined ||
      updateDiscountDto.buyProductIds !== undefined ||
      updateDiscountDto.buyCategoryIds !== undefined ||
      updateDiscountDto.buyCollectionIds !== undefined ||
      updateDiscountDto.buyTagIds !== undefined ||
      updateDiscountDto.getProductIds !== undefined ||
      updateDiscountDto.getCategoryIds !== undefined ||
      updateDiscountDto.getCollectionIds !== undefined ||
      updateDiscountDto.getTagIds !== undefined
    ) {
      // Delete existing relationships
      await this.deleteDiscountRelations(id, updated.type);

      // Create new relationships
      if (
        updated.type === DiscountType.FIXED_AMOUNT ||
        updated.type === DiscountType.PERCENTAGE ||
        updated.type === DiscountType.TIERED
      ) {
        await this.createStandardDiscountRelations(
          id,
          updateDiscountDto as CreateDiscountDto,
        );
      } else if (updated.type === DiscountType.BUY_X_GET_Y) {
        await this.createBuyGetDiscountRelations(
          id,
          updateDiscountDto as CreateDiscountDto,
        );
      }
    }

    // Get existing enriched discount for tracking (before update)
    const existingEnriched = await this.enrichDiscountWithRelations(id);

    const enriched = await this.enrichDiscountWithRelations(id);

    // Track rule change
    try {
      await this.ruleChangeTracker.trackRuleUpdated(existingEnriched, enriched);
    } catch (error) {
      // Log but don't throw - audit logging failure shouldn't break discount update
      console.warn("Failed to track discount rule update:", error);
    }

    // Invalidate cache on discount update
    try {
      await this.invalidationService.invalidateDiscount(id);
    } catch (error) {
      // Log but don't throw - cache invalidation failure shouldn't break discount update
      console.warn("Failed to invalidate discount cache:", error);
    }

    return enriched;
  }

  /**
   * Delete discount
   */
  async remove(id: string): Promise<{ message: string }> {
    const [existing] = await this.db
      .select()
      .from(discounts)
      .where(eq(discounts.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Discount with ID ${id} not found`);
    }

    // Get enriched discount for tracking before deletion
    const existingEnriched = await this.enrichDiscountWithRelations(id);

    // Delete discount (cascade will delete relationships)
    await this.db.delete(discounts).where(eq(discounts.id, id));

    // Track rule deletion
    try {
      await this.ruleChangeTracker.trackRuleDeleted(existingEnriched);
    } catch (error) {
      // Log but don't throw - audit logging failure shouldn't break discount deletion
      console.warn("Failed to track discount rule deletion:", error);
    }

    // Invalidate cache on discount deletion
    try {
      await this.invalidationService.invalidateDiscount(id);
    } catch (error) {
      // Log but don't throw - cache invalidation failure shouldn't break discount deletion
      console.warn("Failed to invalidate discount cache:", error);
    }

    return { message: "Discount deleted successfully" };
  }

  // ============================================================================
  // Public API Methods - Discount Validation & Eligibility
  // ============================================================================

  /**
   * Validate discount code
   */
  async validateDiscount(
    code: string,
    userId?: string,
    orderAmount?: number,
  ): Promise<{
    isValid: boolean;
    discount?: DiscountResponseDto;
    error?: string;
  }> {
    try {
      const discount = await this.findByCode(code);

      // Check if active
      if (!discount.isActive) {
        return {
          isValid: false,
          error: "Discount code is not active",
        };
      }

      // Check expiry
      const now = new Date();
      if (discount.startDate > now) {
        return {
          isValid: false,
          error: "Discount code has not started yet",
        };
      }

      if (discount.endDate && discount.endDate < now) {
        return {
          isValid: false,
          error: "Discount code has expired",
        };
      }

      // Check usage limit
      if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
        return {
          isValid: false,
          error: "Discount code usage limit reached",
        };
      }

      // Check per user limit
      if (userId && discount.perUserLimit) {
        const userUsages = await this.db
          .select()
          .from(discountUsages)
          .where(
            and(
              eq(discountUsages.discountId, discount.id),
              eq(discountUsages.userId, userId),
            ),
          );

        if (userUsages.length >= discount.perUserLimit) {
          return {
            isValid: false,
            error: "You have reached the usage limit for this discount code",
          };
        }
      }

      // Check minimum order amount
      if (orderAmount && discount.minOrderAmount) {
        if (orderAmount < discount.minOrderAmount) {
          return {
            isValid: false,
            error: `Minimum order amount of ₹${discount.minOrderAmount} required`,
          };
        }
      }

      return {
        isValid: true,
        discount,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          isValid: false,
          error: "Invalid discount code",
        };
      }
      throw error;
    }
  }

  /**
   * Get eligible discounts for a cart
   * Uses versioned bundles via HotReloadWatcher (in-memory cache) for ultra-fast access
   */
  async getEligibleDiscounts(
    cartSubtotal: number,
    customerId: string | null,
    userId: string | undefined,
    discountCode?: string,
    cartVariantIds?: string[], // NEW: for eligibility filtering
  ): Promise<DiscountResponseDto[]> {
    const startTime = Date.now();

    // STEP 1: Load discount rules from in-memory cache (via HotReloadWatcher)
    const bundle = this.hotReloadWatcher.getCurrentBundle();
    let rules: DiscountResponseDto[];

    if (bundle?.rules) {
      // Cache hit - use in-memory bundle
      rules = bundle.rules;
      this.profiler.recordRedisLatency(Date.now() - startTime);
    } else {
      // Cache miss - try to rebuild or fallback to DB
      try {
        // Try to trigger rebuild
        await this.rulesetRebuilder.rebuildFromDb();
        const refreshedBundle = this.hotReloadWatcher.getCurrentBundle();
        if (refreshedBundle?.rules) {
          rules = refreshedBundle.rules;
        } else {
          // Final fallback to DB
          rules = await this.loadRulesFromDb();
        }
      } catch (_error) {
        // Rebuild failed, fallback to DB
        rules = await this.loadRulesFromDb();
      }
      this.profiler.recordRedisLatency(Date.now() - startTime);
    }

    // STEP 2: Filter by eligibility using Redis sets (if variant IDs provided)
    // This is an optimization - if Redis cache isn't available, we'll check eligibility
    // in the discount engine based on product/category/collection/tag matching
    if (cartVariantIds && cartVariantIds.length > 0) {
      try {
        rules = await this.filterByEligibility(rules, cartVariantIds);
      } catch (_error) {
        // If eligibility filtering fails (Redis unavailable), continue with all rules
        // The discount engine will filter based on product matching
        // This ensures automatic discounts work even if Redis cache isn't warmed up
      }
    }

    // STEP 3: Apply constraints (dates, limits, amounts)
    // Only include AUTOMATIC discounts here - MANUAL discounts require code entry
    const eligible: DiscountResponseDto[] = [];
    for (const discount of rules) {
      try {
        // Skip MANUAL discounts - they should only be applied when code is provided
        if (discount.applicationType === DiscountApplicationType.MANUAL) {
          // Only include if this discount matches the provided code
          if (discountCode && discount.code === discountCode) {
            // Will be validated and added in STEP 4
            continue;
          } else {
            // Skip MANUAL discounts that don't match the code
            continue;
          }
        }

        // For AUTOMATIC discounts, check eligibility constraints
        const isEligible = await passesEligibilityConstraints(
          discount,
          cartSubtotal,
          userId,
          this.db, // Pass injected db instance
        );

        if (isEligible) {
          eligible.push(discount);
        }
      } catch {
        // Skip discount on error
      }
    }

    // STEP 4: Add manual discount code if provided
    if (discountCode) {
      try {
        const validation = await this.validateDiscount(
          discountCode,
          userId,
          cartSubtotal,
        );

        if (
          validation.isValid &&
          validation.discount &&
          !isDiscountAlreadyInList(validation.discount.id, eligible)
        ) {
          eligible.push(validation.discount);
        }
      } catch {
        // Invalid discount code, skip
      }
    }

    return eligible;
  }

  /**
   * Load discount rules from database (fallback when Redis cache miss)
   */
  private async loadRulesFromDb(): Promise<DiscountResponseDto[]> {
    const now = new Date();
    const automaticDiscounts = await this.db
      .select()
      .from(discounts)
      .where(
        and(
          eq(discounts.applicationType, DiscountApplicationType.AUTOMATIC),
          eq(discounts.isActive, true),
          lte(discounts.startDate, now),
          or(sql`${discounts.endDate} IS NULL`, gte(discounts.endDate, now)),
        ),
      );

    // Enrich with relations
    const enriched = await Promise.all(
      automaticDiscounts.map((discount) =>
        this.enrichDiscountWithRelations(discount.id),
      ),
    );

    return enriched;
  }

  /**
   * Filter discounts by eligibility using Redis sets
   * Falls back to including all discounts if Redis cache is unavailable
   * (The discount engine will filter based on product/category/collection/tag matching)
   */
  private async filterByEligibility(
    rules: DiscountResponseDto[],
    variantIds: string[],
  ): Promise<DiscountResponseDto[]> {
    const variantIdSet = new Set(variantIds);
    const eligible: DiscountResponseDto[] = [];
    let _hasCacheMiss = false;

    for (const rule of rules) {
      try {
        // Check eligibility from Redis
        const eligibilitySet = await this.eligibilityStore.getEligibility(
          rule.id,
        );

        if (!eligibilitySet) {
          // Not cached - include it anyway, discount engine will check eligibility
          // This ensures automatic discounts work even if Redis cache isn't warmed up
          _hasCacheMiss = true;
          eligible.push(rule);
          continue;
        }

        // Check if any cart variant is eligible
        const hasEligibleVariant = Array.from(variantIdSet).some((vid) =>
          eligibilitySet.has(vid),
        );

        if (hasEligibleVariant) {
          eligible.push(rule);
        }
      } catch (_error) {
        // Redis error - include discount anyway, let discount engine filter it
        _hasCacheMiss = true;
        eligible.push(rule);
      }
    }

    // Note: If cache misses occur, discounts are still included
    // The discount engine will filter them based on product/category/collection/tag matching

    return eligible;
  }

  // ============================================================================
  // Public API Methods - Usage Tracking
  // ============================================================================

  /**
   * Record discount usage
   */
  async recordUsage(
    discountId: string,
    orderId: string,
    userId?: string,
  ): Promise<void> {
    await this.db.insert(discountUsages).values({
      discountId,
      orderId,
      userId: userId || null,
    });

    // Increment usage count
    const [currentDiscount] = await this.db
      .select({ usageCount: discounts.usageCount })
      .from(discounts)
      .where(eq(discounts.id, discountId))
      .limit(1);

    if (currentDiscount) {
      await this.db
        .update(discounts)
        .set({
          usageCount: currentDiscount.usageCount + 1,
        })
        .where(eq(discounts.id, discountId));
    }
  }

  /**
   * Create STANDARD discount relationships
   */
  private async createStandardDiscountRelations(
    discountId: string,
    dto: CreateDiscountDto,
  ): Promise<void> {
    // Products
    if (dto.productIds && dto.productIds.length > 0) {
      await this.db.insert(discountProducts).values(
        dto.productIds.map((productId) => ({
          discountId,
          productId,
        })),
      );
    }

    // Categories
    if (dto.categoryIds && dto.categoryIds.length > 0) {
      await this.db.insert(discountCategories).values(
        dto.categoryIds.map((categoryId) => ({
          discountId,
          categoryId,
        })),
      );
    }

    // Collections
    if (dto.collectionIds && dto.collectionIds.length > 0) {
      await this.db.insert(discountCollections).values(
        dto.collectionIds.map((collectionId) => ({
          discountId,
          collectionId,
        })),
      );
    }

    // Tags
    if (dto.tagIds && dto.tagIds.length > 0) {
      await this.db.insert(discountTags).values(
        dto.tagIds.map((tagId) => ({
          discountId,
          tagId,
        })),
      );
    }
  }

  /**
   * Create BUY_GET discount relationships
   */
  private async createBuyGetDiscountRelations(
    discountId: string,
    dto: CreateDiscountDto,
  ): Promise<void> {
    // Buy products
    if (dto.buyProductIds && dto.buyProductIds.length > 0) {
      await this.db.insert(discountProducts).values(
        dto.buyProductIds.map((productId) => ({
          discountId,
          productId,
        })),
      );
    }

    // Buy categories
    if (dto.buyCategoryIds && dto.buyCategoryIds.length > 0) {
      await this.db.insert(discountCategories).values(
        dto.buyCategoryIds.map((categoryId) => ({
          discountId,
          categoryId,
        })),
      );
    }

    // Buy collections
    if (dto.buyCollectionIds && dto.buyCollectionIds.length > 0) {
      await this.db.insert(discountCollections).values(
        dto.buyCollectionIds.map((collectionId) => ({
          discountId,
          collectionId,
        })),
      );
    }

    // Buy tags
    if (dto.buyTagIds && dto.buyTagIds.length > 0) {
      await this.db.insert(discountTags).values(
        dto.buyTagIds.map((tagId) => ({
          discountId,
          tagId,
        })),
      );
    }

    // Get products
    if (dto.getProductIds && dto.getProductIds.length > 0) {
      await this.db.insert(discountGetProducts).values(
        dto.getProductIds.map((productId) => ({
          discountId,
          productId,
        })),
      );
    }

    // Get categories
    if (dto.getCategoryIds && dto.getCategoryIds.length > 0) {
      await this.db.insert(discountGetCategories).values(
        dto.getCategoryIds.map((categoryId) => ({
          discountId,
          categoryId,
        })),
      );
    }

    // Get collections
    if (dto.getCollectionIds && dto.getCollectionIds.length > 0) {
      await this.db.insert(discountGetCollections).values(
        dto.getCollectionIds.map((collectionId) => ({
          discountId,
          collectionId,
        })),
      );
    }

    // Get tags
    if (dto.getTagIds && dto.getTagIds.length > 0) {
      await this.db.insert(discountGetTags).values(
        dto.getTagIds.map((tagId) => ({
          discountId,
          tagId,
        })),
      );
    }
  }

  /**
   * Delete all discount relationships
   */
  private async deleteDiscountRelations(
    discountId: string,
    type: string,
  ): Promise<void> {
    // Delete STANDARD relationships
    await this.db
      .delete(discountProducts)
      .where(eq(discountProducts.discountId, discountId));
    await this.db
      .delete(discountCategories)
      .where(eq(discountCategories.discountId, discountId));
    await this.db
      .delete(discountCollections)
      .where(eq(discountCollections.discountId, discountId));
    await this.db
      .delete(discountTags)
      .where(eq(discountTags.discountId, discountId));

    // Delete BUY_X_GET_Y relationships
    if (type === DiscountType.BUY_X_GET_Y) {
      await this.db
        .delete(discountGetProducts)
        .where(eq(discountGetProducts.discountId, discountId));
      await this.db
        .delete(discountGetCategories)
        .where(eq(discountGetCategories.discountId, discountId));
      await this.db
        .delete(discountGetCollections)
        .where(eq(discountGetCollections.discountId, discountId));
      await this.db
        .delete(discountGetTags)
        .where(eq(discountGetTags.discountId, discountId));
    }
  }

  /**
   * Enrich discount with relationships
   */
  private async enrichDiscountWithRelations(
    discountId: string,
  ): Promise<DiscountResponseDto> {
    const [discount] = await this.db
      .select()
      .from(discounts)
      .where(eq(discounts.id, discountId))
      .limit(1);

    if (!discount) {
      throw new NotFoundException(`Discount with ID ${discountId} not found`);
    }

    // Get product IDs
    const discountProductsList = await this.db
      .select({ productId: discountProducts.productId })
      .from(discountProducts)
      .where(eq(discountProducts.discountId, discountId));

    // Get category IDs
    const discountCategoriesList = await this.db
      .select({ categoryId: discountCategories.categoryId })
      .from(discountCategories)
      .where(eq(discountCategories.discountId, discountId));

    // Get collection IDs
    const discountCollectionsList = await this.db
      .select({ collectionId: discountCollections.collectionId })
      .from(discountCollections)
      .where(eq(discountCollections.discountId, discountId));

    // Get tag IDs
    const discountTagsList = await this.db
      .select({ tagId: discountTags.tagId })
      .from(discountTags)
      .where(eq(discountTags.discountId, discountId));

    // Get BUY_GET relationships
    const getProductsList = await this.db
      .select({ productId: discountGetProducts.productId })
      .from(discountGetProducts)
      .where(eq(discountGetProducts.discountId, discountId));

    const getCategoriesList = await this.db
      .select({ categoryId: discountGetCategories.categoryId })
      .from(discountGetCategories)
      .where(eq(discountGetCategories.discountId, discountId));

    const getCollectionsList = await this.db
      .select({ collectionId: discountGetCollections.collectionId })
      .from(discountGetCollections)
      .where(eq(discountGetCollections.discountId, discountId));

    const getTagsList = await this.db
      .select({ tagId: discountGetTags.tagId })
      .from(discountGetTags)
      .where(eq(discountGetTags.discountId, discountId));

    // Get tiered rules
    const tieredRulesList = await this.db
      .select({
        minQuantity: discountTieredRules.minQuantity,
        value: discountTieredRules.value,
        valueType: discountTieredRules.valueType,
      })
      .from(discountTieredRules)
      .where(eq(discountTieredRules.discountId, discountId))
      .orderBy(discountTieredRules.minQuantity);

    // Get exclusions
    const exclusionsList = await this.db
      .select({ excludedDiscountId: discountExclusions.excludedDiscountId })
      .from(discountExclusions)
      .where(eq(discountExclusions.discountId, discountId));

    return {
      id: discount.id,
      code: discount.code,
      name: discount.name,
      description: discount.description,
      type: discount.type as DiscountType,
      applicationType: discount.applicationType as DiscountApplicationType,
      valueType: discount.valueType as DiscountValueType,
      value: Number(discount.value),
      minOrderAmount: discount.minOrderAmount
        ? Number(discount.minOrderAmount)
        : null,
      maxDiscountAmount: discount.maxDiscountAmount
        ? Number(discount.maxDiscountAmount)
        : null,
      scope: discount.scope as DiscountScope,
      appliesTo: discount.appliesTo as DiscountAppliesTo,
      priority: discount.priority,
      canStack: discount.canStack,
      mutuallyExclusive: discount.mutuallyExclusive,
      minQuantity: discount.minQuantity ? Number(discount.minQuantity) : null,
      customerGroupIds: discount.customerGroupIds,
      startDate: discount.startDate,
      endDate: discount.endDate,
      isActive: discount.isActive,
      usageLimit: discount.usageLimit,
      usageCount: discount.usageCount,
      perUserLimit: discount.perUserLimit,
      // For BUY_X_GET_Y type, productIds/categoryIds etc. are the "buy" items
      // For other types, they are the items the discount applies to
      productIds:
        discount.type === DiscountType.BUY_X_GET_Y
          ? []
          : discountProductsList.map((product) => product.productId),
      categoryIds:
        discount.type === DiscountType.BUY_X_GET_Y
          ? []
          : discountCategoriesList.map((category) => category.categoryId),
      collectionIds:
        discount.type === DiscountType.BUY_X_GET_Y
          ? []
          : discountCollectionsList.map(
              (collection) => collection.collectionId,
            ),
      tagIds:
        discount.type === DiscountType.BUY_X_GET_Y
          ? []
          : discountTagsList.map((tag) => tag.tagId),
      buyProductIds:
        discount.type === DiscountType.BUY_X_GET_Y
          ? discountProductsList.map((product) => product.productId)
          : [],
      buyCategoryIds:
        discount.type === DiscountType.BUY_X_GET_Y
          ? discountCategoriesList.map((category) => category.categoryId)
          : [],
      buyCollectionIds:
        discount.type === DiscountType.BUY_X_GET_Y
          ? discountCollectionsList.map((collection) => collection.collectionId)
          : [],
      buyTagIds:
        discount.type === DiscountType.BUY_X_GET_Y
          ? discountTagsList.map((tag) => tag.tagId)
          : [],
      getProductIds: getProductsList.map((product) => product.productId),
      getCategoryIds: getCategoriesList.map((category) => category.categoryId),
      getCollectionIds: getCollectionsList.map(
        (collection) => collection.collectionId,
      ),
      getTagIds: getTagsList.map((tag) => tag.tagId),
      tieredRules: tieredRulesList.map((rule) => ({
        minQuantity: Number(rule.minQuantity),
        value: Number(rule.value),
        valueType: rule.valueType as DiscountValueType,
      })),
      excludedDiscountIds: exclusionsList.map(
        (exclusion) => exclusion.excludedDiscountId,
      ),
      createdAt: discount.createdAt,
      updatedAt: discount.updatedAt,
    };
  }

  /**
   * Create tiered rules for a discount
   */
  private async createTieredRules(
    discountId: string,
    tieredRules: Array<{
      minQuantity: number;
      value: number;
      valueType: string;
    }>,
  ): Promise<void> {
    const rules = tieredRules.map((rule) => ({
      discountId,
      minQuantity: rule.minQuantity,
      value: rule.value,
      valueType: rule.valueType as DiscountValueType,
    }));

    await this.db.insert(discountTieredRules).values(rules);
  }

  /**
   * Create discount exclusions
   */
  private async createDiscountExclusions(
    discountId: string,
    excludedDiscountIds: string[],
  ): Promise<void> {
    const exclusions = excludedDiscountIds.map((excludedId) => ({
      discountId,
      excludedDiscountId: excludedId,
    }));

    await this.db.insert(discountExclusions).values(exclusions);
  }
}
