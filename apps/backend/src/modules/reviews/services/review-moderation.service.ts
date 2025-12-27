import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  and,
  customers,
  desc,
  eq,
  reviewHelpfulVotes,
  reviews,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { AUTO_APPROVE_THRESHOLD } from "../../../common/constants";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { ReviewResponseDto } from "../dto/review-response.dto";
import { ReviewAggregationService } from "./review-aggregation.service";
import { ReviewCacheService } from "./review-cache.service";
import { ReviewEventsService } from "./review-events.service";

@Injectable()
export class ReviewModerationService {
  constructor(
    private readonly aggregationService: ReviewAggregationService,
    private readonly cacheService: ReviewCacheService,
    private readonly eventsService: ReviewEventsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get all pending reviews
   */
  async getPendingReviews(
    page = 1,
    limit = 20,
  ): Promise<{
    data: ReviewResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.status, "pending"));
    const total = Number(countResult?.count || 0);
    const totalPages = Math.ceil(total / limit);

    // Get pending reviews
    const pendingReviews = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.status, "pending"))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich reviews
    const enrichedReviews = await Promise.all(
      pendingReviews.map((review) => this.enrichReview(review)),
    );

    return {
      data: enrichedReviews,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Approve a review
   * Updates aggregate and cache
   */
  async approveReview(reviewId: string): Promise<ReviewResponseDto> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review) {
      throw new BadRequestException(`Review with ID ${reviewId} not found`);
    }

    if (review.status === "approved") {
      throw new BadRequestException("Review is already approved");
    }

    // Update status
    const [updatedReview] = await this.db
      .update(reviews)
      .set({
        status: "approved",
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId))
      .returning();

    // Recompute aggregate
    await this.aggregationService.recomputeAggregate(updatedReview.variantId);

    // Invalidate cache
    await this.cacheService.invalidateVariant(updatedReview.variantId);

    // Emit event
    await this.eventsService.emitApproved({
      reviewId: updatedReview.id,
      variantId: updatedReview.variantId,
      customerId: updatedReview.customerId,
      rating: updatedReview.rating,
      timestamp: updatedReview.updatedAt.toISOString(),
    });

    this.logger.info(
      createLogContext(this.contextService, "approveReview", {
        reviewId,
        variantId: updatedReview.variantId,
        customerId: updatedReview.customerId,
      }),
      "Review approved",
    );

    return this.enrichReview(updatedReview);
  }

  /**
   * Reject a review
   */
  async rejectReview(reviewId: string): Promise<ReviewResponseDto> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review) {
      throw new BadRequestException(`Review with ID ${reviewId} not found`);
    }

    if (review.status === "rejected") {
      throw new BadRequestException("Review is already rejected");
    }

    // Update status
    const [updatedReview] = await this.db
      .update(reviews)
      .set({
        status: "rejected",
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId))
      .returning();

    // If was approved, recompute aggregate (to remove from counts)
    if (review.status === "approved") {
      await this.aggregationService.recomputeAggregate(updatedReview.variantId);
      await this.cacheService.invalidateVariant(updatedReview.variantId);
    }

    // Emit event
    await this.eventsService.emitRejected({
      reviewId: updatedReview.id,
      variantId: updatedReview.variantId,
      customerId: updatedReview.customerId,
      rating: updatedReview.rating,
      timestamp: updatedReview.updatedAt.toISOString(),
    });

    this.logger.info(
      createLogContext(this.contextService, "rejectReview", {
        reviewId,
        variantId: updatedReview.variantId,
        customerId: updatedReview.customerId,
      }),
      "Review rejected",
    );

    return this.enrichReview(updatedReview);
  }

  /**
   * Hard delete a review (admin only)
   */
  async deleteReview(reviewId: string): Promise<void> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review) {
      throw new BadRequestException(`Review with ID ${reviewId} not found`);
    }

    // Delete review
    await this.db.delete(reviews).where(eq(reviews.id, reviewId));

    // If was approved, recompute aggregate
    if (review.status === "approved") {
      await this.aggregationService.recomputeAggregate(review.variantId);
      await this.cacheService.invalidateVariant(review.variantId);
    }

    this.logger.info(
      createLogContext(this.contextService, "deleteReview", {
        reviewId,
        variantId: review.variantId,
        customerId: review.customerId,
      }),
      "Review hard deleted by admin",
    );
  }

  /**
   * Check if customer should get auto-approved
   * Returns true if customer has >= AUTO_APPROVE_THRESHOLD approved reviews
   */
  async shouldAutoApprove(customerId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(
        and(eq(reviews.customerId, customerId), eq(reviews.status, "approved")),
      );

    const approvedCount = Number(result?.count || 0);
    return approvedCount >= AUTO_APPROVE_THRESHOLD;
  }

  /**
   * Auto-approve review if customer meets threshold
   * Called after review creation
   */
  async tryAutoApprove(reviewId: string): Promise<boolean> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review || review.status !== "pending") {
      return false;
    }

    const shouldAutoApprove = await this.shouldAutoApprove(review.customerId);

    if (shouldAutoApprove) {
      await this.approveReview(reviewId);
      this.logger.info(
        `Review ${reviewId} auto-approved (customer has ${AUTO_APPROVE_THRESHOLD}+ approved reviews)`,
      );
      return true;
    }

    return false;
  }

  /**
   * Search reviews (admin)
   */
  async searchReviews(
    filters: {
      variantId?: string;
      customerId?: string;
      status?: "pending" | "approved" | "rejected";
      minRating?: number;
      maxRating?: number;
    },
    page = 1,
    limit = 20,
  ): Promise<{
    data: ReviewResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: ReturnType<typeof eq | typeof sql>[] = [];
    if (filters.variantId) {
      conditions.push(eq(reviews.variantId, filters.variantId));
    }
    if (filters.customerId) {
      conditions.push(eq(reviews.customerId, filters.customerId));
    }
    if (filters.status) {
      conditions.push(eq(reviews.status, filters.status));
    }
    if (filters.minRating) {
      conditions.push(sql`${reviews.rating} >= ${filters.minRating}`);
    }
    if (filters.maxRating) {
      conditions.push(sql`${reviews.rating} <= ${filters.maxRating}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(reviews);
    if (whereClause) {
      countQuery.where(whereClause);
    }
    const [countResult] = await countQuery;
    const total = Number(countResult?.count || 0);
    const totalPages = Math.ceil(total / limit);

    // Get reviews
    const query = this.db
      .select()
      .from(reviews)
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);
    if (whereClause) {
      query.where(whereClause);
    }
    const reviewList = await query;

    // Enrich reviews
    const enrichedReviews = await Promise.all(
      reviewList.map((review) => this.enrichReview(review)),
    );

    return {
      data: enrichedReviews,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Enrich review with customer info
   */
  private async enrichReview(
    review: typeof reviews.$inferSelect,
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
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}
