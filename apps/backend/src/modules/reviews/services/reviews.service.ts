import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  customers,
  desc,
  eq,
  gte,
  orderItems,
  orders,
  reviewHelpfulVotes,
  reviews,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { NotificationsService } from "../../notifications/notifications.service";
import { NotificationType } from "../../notifications/types/notification.types";
import { CreateReviewDto } from "../dto/create-review.dto";
import { ReviewQueryDto, ReviewSortOrder } from "../dto/review-query.dto";
import { ReviewResponseDto } from "../dto/review-response.dto";
import { UpdateReviewDto } from "../dto/update-review.dto";
import { ReviewAggregationService } from "./review-aggregation.service";
import { ReviewCacheService } from "./review-cache.service";
import { ReviewEventsService } from "./review-events.service";
import { ReviewModerationService } from "./review-moderation.service";

/**
 * Configuration for review editing
 */
const REVIEW_EDIT_DAYS_LIMIT = 30; // Days after creation when editing is allowed

@Injectable()
export class ReviewsService {
  constructor(
    private readonly aggregationService: ReviewAggregationService,
    private readonly cacheService: ReviewCacheService,
    private readonly moderationService: ReviewModerationService,
    private readonly eventsService: ReviewEventsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly notificationsService: NotificationsService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Create a new review
   * Validates:
   * - Verified purchase (order is delivered and contains variant)
   * - One review per variant per customer
   * - Image count (max 5)
   */
  async create(
    customerId: string,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    // Validate verified purchase
    await this.validateVerifiedPurchase(
      customerId,
      createReviewDto.orderId,
      createReviewDto.variantId,
    );

    // Check if review already exists for this customer + variant
    let existingReview: typeof reviews.$inferSelect | undefined;
    try {
      const existingReviewResult = await this.db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.customerId, customerId),
            eq(reviews.variantId, createReviewDto.variantId),
          ),
        )
        .limit(1);
      existingReview = existingReviewResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ReviewsService.create.selectExistingReview",
          error,
          { customerId, variantId: createReviewDto.variantId },
        ),
        "Failed to check existing review",
      );
      throw error;
    }

    if (existingReview) {
      throw new BadRequestException(
        "You have already reviewed this product variant",
      );
    }

    // Validate images count
    if (createReviewDto.images && createReviewDto.images.length > 5) {
      throw new BadRequestException("Maximum 5 images allowed");
    }

    // Create review
    let newReview: typeof reviews.$inferSelect | undefined;
    try {
      const reviewResult = await this.db
        .insert(reviews)
        .values({
          customerId,
          orderId: createReviewDto.orderId,
          variantId: createReviewDto.variantId,
          rating: createReviewDto.rating,
          title: createReviewDto.title || null,
          body: createReviewDto.body,
          images: createReviewDto.images || null,
          status: "pending",
        })
        .returning();
      newReview = reviewResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ReviewsService.create.insertReview",
          error,
          { customerId, createReviewDto },
        ),
        "Failed to create review",
      );
      throw error;
    }

    if (!newReview) {
      throw new BadRequestException("Failed to create review");
    }

    this.logger.info(
      `Review created: ${newReview.id} for variant ${createReviewDto.variantId}`,
    );

    // Try auto-approve if customer has enough approved reviews
    await this.moderationService.tryAutoApprove(newReview.id);

    // Refresh review to check if still pending after auto-approve attempt
    let checkReview: typeof reviews.$inferSelect | undefined;
    try {
      const checkReviewResult = await this.db
        .select()
        .from(reviews)
        .where(eq(reviews.id, newReview.id))
        .limit(1);
      checkReview = checkReviewResult[0] || newReview;
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "ReviewsService.create.selectCheckReview",
          {
            reviewId: newReview.id,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to refresh review, using original review",
      );
      checkReview = newReview;
    }

    // Create notification if review is still pending
    if (checkReview && checkReview.status === "pending") {
      try {
        await this.notificationsService.createFromEvent({
          adminId: null, // Broadcast to all admins
          type: NotificationType.REVIEW,
          title: "Review Pending Approval",
          message: `A new ${createReviewDto.rating}-star review is pending approval`,
          meta: {
            reviewId: newReview.id,
            variantId: createReviewDto.variantId,
            rating: createReviewDto.rating,
            orderId: createReviewDto.orderId,
          },
        });
      } catch (error) {
        // Log but don't throw - notification failure shouldn't break review creation
        this.logger.warn(
          {
            reviewId: newReview.id,
            error,
          },
          "Failed to create review notification",
        );
      }
    }

    // Refresh review to get updated status
    const [refreshedReview] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, newReview.id))
      .limit(1);

    // If auto-approved, update aggregate and cache
    if (refreshedReview?.status === "approved") {
      await this.aggregationService.recomputeAggregate(
        refreshedReview.variantId,
      );
      await this.cacheService.invalidateVariant(refreshedReview.variantId);
    }

    // Return enriched review
    return this.enrichReview(refreshedReview || newReview, customerId);
  }

  /**
   * Get reviews for a variant with pagination and filtering
   */
  async findByVariant(
    variantId: string,
    query: ReviewQueryDto,
    customerId?: string,
  ): Promise<{
    data: ReviewResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Try cache first (only if no customerId - cache doesn't have helpful status)
    const cached = await this.cacheService.getReviews(variantId, query);
    if (cached && !customerId) {
      return cached;
    }

    // Build where conditions
    const whereConditions = and(
      eq(reviews.variantId, variantId),
      eq(reviews.status, "approved"), // Only show approved reviews
      query.minRating ? gte(reviews.rating, query.minRating) : undefined,
      query.imagesOnly
        ? sql`${reviews.images} IS NOT NULL AND jsonb_array_length(${reviews.images}) > 0`
        : undefined,
    );

    // Get total count
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(whereConditions);
    const total = Number(countResult?.count || 0);

    // Calculate pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Build order by clause
    let orderByClause:
      | typeof reviews.createdAt
      | typeof reviews.rating
      | ReturnType<typeof desc>;
    switch (query.sort) {
      case ReviewSortOrder.OLDEST:
        orderByClause = reviews.createdAt;
        break;
      case ReviewSortOrder.HIGHEST:
        orderByClause = desc(reviews.rating);
        break;
      case ReviewSortOrder.LOWEST:
        orderByClause = reviews.rating;
        break;
      case ReviewSortOrder.HELPFUL:
        // Order by helpful count (requires join)
        orderByClause = desc(
          sql`(SELECT COUNT(*) FROM ${reviewHelpfulVotes} WHERE ${reviewHelpfulVotes.reviewId} = ${reviews.id})`,
        );
        break;
      default:
        orderByClause = desc(reviews.createdAt);
        break;
    }

    // Fetch reviews
    const reviewList = await this.db
      .select()
      .from(reviews)
      .where(whereConditions)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Enrich reviews
    const enrichedReviews = await Promise.all(
      reviewList.map((review) => this.enrichReview(review, customerId)),
    );

    // Cache the results
    await this.cacheService.setReviews(variantId, query, {
      data: enrichedReviews,
      total,
      page,
      limit,
      totalPages,
    });

    return {
      data: enrichedReviews,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get a single review by ID
   */
  async findOne(
    reviewId: string,
    customerId?: string,
  ): Promise<ReviewResponseDto> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review) {
      throw new NotFoundException(`Review with ID ${reviewId} not found`);
    }

    return this.enrichReview(review, customerId);
  }

  /**
   * Update a review
   * Only allowed if:
   * - Review belongs to customer
   * - Review is not rejected
   * - Within edit time limit
   */
  async update(
    reviewId: string,
    customerId: string,
    updateReviewDto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review) {
      throw new NotFoundException(`Review with ID ${reviewId} not found`);
    }

    // Check ownership
    if (review.customerId !== customerId) {
      throw new ForbiddenException("You can only edit your own reviews");
    }

    // Check if rejected
    if (review.status === "rejected") {
      throw new BadRequestException("Cannot edit a rejected review");
    }

    // Check edit time limit
    const daysSinceCreation =
      (Date.now() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > REVIEW_EDIT_DAYS_LIMIT) {
      throw new BadRequestException(
        `Reviews can only be edited within ${REVIEW_EDIT_DAYS_LIMIT} days of creation`,
      );
    }

    // Validate images count
    const imagesToSet =
      updateReviewDto.images !== undefined
        ? updateReviewDto.images
        : review.images;
    if (imagesToSet && imagesToSet.length > 5) {
      throw new BadRequestException("Maximum 5 images allowed");
    }

    // Update review
    const updateData: Partial<typeof reviews.$inferInsert> = {};
    if (updateReviewDto.rating !== undefined)
      updateData.rating = updateReviewDto.rating;
    if (updateReviewDto.title !== undefined)
      updateData.title = updateReviewDto.title || null;
    if (updateReviewDto.body !== undefined)
      updateData.body = updateReviewDto.body;
    if (updateReviewDto.images !== undefined)
      updateData.images = updateReviewDto.images || null;

    const [updatedReview] = await this.db
      .update(reviews)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId))
      .returning();

    // If rating changed and review is approved, update aggregates
    if (
      updateReviewDto.rating !== undefined &&
      updatedReview.status === "approved"
    ) {
      await this.aggregationService.recomputeAggregate(updatedReview.variantId);
    }

    // Invalidate cache
    await this.cacheService.invalidateVariant(updatedReview.variantId);

    this.logger.info(
      createLogContext(this.contextService, "update", {
        reviewId,
        variantId: updatedReview.variantId,
        customerId,
      }),
      "Review updated",
    );

    return this.enrichReview(updatedReview, customerId);
  }

  /**
   * Delete a review (soft delete - customer can delete own, admin can hard delete)
   */
  async remove(reviewId: string, customerId: string): Promise<void> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review) {
      throw new NotFoundException(`Review with ID ${reviewId} not found`);
    }

    // Check ownership
    if (review.customerId !== customerId) {
      throw new ForbiddenException("You can only delete your own reviews");
    }

    // Delete review
    await this.db.delete(reviews).where(eq(reviews.id, reviewId));

    // If approved, update aggregates
    if (review.status === "approved") {
      await this.aggregationService.recomputeAggregate(review.variantId);
    }

    // Invalidate cache
    await this.cacheService.invalidateVariant(review.variantId);

    this.logger.info(
      createLogContext(this.contextService, "remove", {
        reviewId,
        variantId: review.variantId,
        customerId,
      }),
      "Review deleted",
    );
  }

  /**
   * Mark review as helpful (idempotent)
   */
  async markHelpful(
    reviewId: string,
    customerId: string,
  ): Promise<{ helpful: boolean }> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review) {
      throw new NotFoundException(`Review with ID ${reviewId} not found`);
    }

    // Check if already marked helpful
    const [existingVote] = await this.db
      .select()
      .from(reviewHelpfulVotes)
      .where(
        and(
          eq(reviewHelpfulVotes.reviewId, reviewId),
          eq(reviewHelpfulVotes.customerId, customerId),
        ),
      )
      .limit(1);

    if (existingVote) {
      return { helpful: true };
    }

    // Add helpful vote
    await this.db.insert(reviewHelpfulVotes).values({
      reviewId,
      customerId,
    });

    // Invalidate cache
    await this.cacheService.invalidateVariant(review.variantId);

    // Emit event
    await this.eventsService.emitHelpfulAdded({
      reviewId: review.id,
      variantId: review.variantId,
      customerId: review.customerId,
      rating: review.rating,
      timestamp: new Date().toISOString(),
      metadata: { voterId: customerId },
    });

    this.logger.info(
      createLogContext(this.contextService, "markHelpful", {
        reviewId,
        variantId: review.variantId,
        customerId,
        voterId: customerId,
      }),
      "Review marked helpful",
    );

    return { helpful: true };
  }

  /**
   * Remove helpful vote
   */
  async removeHelpful(
    reviewId: string,
    customerId: string,
  ): Promise<{ helpful: boolean }> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review) {
      throw new NotFoundException(`Review with ID ${reviewId} not found`);
    }

    // Remove helpful vote
    await this.db
      .delete(reviewHelpfulVotes)
      .where(
        and(
          eq(reviewHelpfulVotes.reviewId, reviewId),
          eq(reviewHelpfulVotes.customerId, customerId),
        ),
      );

    // Invalidate cache
    await this.cacheService.invalidateVariant(review.variantId);

    // Emit event
    await this.eventsService.emitHelpfulRemoved({
      reviewId: review.id,
      variantId: review.variantId,
      customerId: review.customerId,
      rating: review.rating,
      timestamp: new Date().toISOString(),
      metadata: { voterId: customerId },
    });

    this.logger.info(
      createLogContext(this.contextService, "removeHelpful", {
        reviewId,
        variantId: review.variantId,
        customerId,
        voterId: customerId,
      }),
      "Helpful vote removed for review",
    );

    return { helpful: false };
  }

  /**
   * Validate verified purchase
   * Checks:
   * - Order exists and belongs to customer
   * - Order status is "delivered"
   * - Order contains the variant
   */
  private async validateVerifiedPurchase(
    customerId: string,
    orderId: string,
    variantId: string,
  ): Promise<void> {
    // Check order exists and belongs to customer
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found or does not belong to you");
    }

    // Check order is delivered
    if (order.status !== "delivered") {
      throw new BadRequestException(
        "You can only review products from delivered orders",
      );
    }

    // Check variant exists in order items
    const [orderItem] = await this.db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, orderId),
          eq(orderItems.productVariantId, variantId),
        ),
      )
      .limit(1);

    if (!orderItem) {
      throw new BadRequestException(
        "This variant was not purchased in the specified order",
      );
    }
  }

  /**
   * Enrich review with customer info and helpful count
   */
  private async enrichReview(
    review: typeof reviews.$inferSelect,
    customerId?: string,
  ): Promise<ReviewResponseDto> {
    // Get customer name
    const [customer] = await this.db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, review.customerId))
      .limit(1);

    // Get helpful count
    const helpfulVotes = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(reviewHelpfulVotes)
      .where(eq(reviewHelpfulVotes.reviewId, review.id));

    const helpfulCount = Number(helpfulVotes[0]?.count || 0);

    // Check if current user marked as helpful
    let isHelpful = false;
    if (customerId) {
      const [vote] = await this.db
        .select()
        .from(reviewHelpfulVotes)
        .where(
          and(
            eq(reviewHelpfulVotes.reviewId, review.id),
            eq(reviewHelpfulVotes.customerId, customerId),
          ),
        )
        .limit(1);
      isHelpful = !!vote;
    }

    return {
      id: review.id,
      customerId: review.customerId,
      customerName: customer?.name || "Anonymous",
      orderId: review.orderId,
      variantId: review.variantId,
      rating: review.rating,
      title: review.title,
      body: review.body,
      images: review.images as string[] | null,
      status: review.status as "pending" | "approved" | "rejected",
      helpfulCount,
      isHelpful,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}
