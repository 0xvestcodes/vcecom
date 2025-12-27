import { Inject, Injectable } from "@nestjs/common";
import { and, eq, reviews, variantReviewAggregate } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { ReviewAggregateDto } from "../dto/review-aggregate.dto";
import { ReviewCacheService } from "./review-cache.service";

@Injectable()
export class ReviewAggregationService {
  constructor(
    private readonly cacheService: ReviewCacheService,
    private readonly logger: PinoLogger,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Recompute aggregate for a variant
   * Called when:
   * - Review is approved/rejected
   * - Review is updated (rating changed)
   * - Review is deleted
   */
  async recomputeAggregate(variantId: string): Promise<void> {
    // Get all approved reviews for this variant
    const approvedReviews = await this.db
      .select({
        rating: reviews.rating,
      })
      .from(reviews)
      .where(
        and(eq(reviews.variantId, variantId), eq(reviews.status, "approved")),
      );

    const reviewCount = approvedReviews.length;

    if (reviewCount === 0) {
      // No reviews - set to zero/default
      await this.db
        .insert(variantReviewAggregate)
        .values({
          variantId,
          averageRating: 0,
          reviewCount: 0,
          rating1Count: 0,
          rating2Count: 0,
          rating3Count: 0,
          rating4Count: 0,
          rating5Count: 0,
        })
        .onConflictDoUpdate({
          target: variantReviewAggregate.variantId,
          set: {
            averageRating: 0,
            reviewCount: 0,
            rating1Count: 0,
            rating2Count: 0,
            rating3Count: 0,
            rating4Count: 0,
            rating5Count: 0,
            updatedAt: new Date(),
          },
        });

      // Update cache
      await this.cacheService.setAggregate(variantId, {
        variantId,
        averageRating: 0,
        reviewCount: 0,
        rating1Count: 0,
        rating2Count: 0,
        rating3Count: 0,
        rating4Count: 0,
        rating5Count: 0,
        updatedAt: new Date(),
      });

      return;
    }

    // Calculate aggregates
    const ratingCounts = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    let totalRating = 0;
    for (const review of approvedReviews) {
      ratingCounts[review.rating as keyof typeof ratingCounts]++;
      totalRating += review.rating;
    }

    const averageRating = totalRating / reviewCount;

    // Update database
    await this.db
      .insert(variantReviewAggregate)
      .values({
        variantId,
        averageRating,
        reviewCount,
        rating1Count: ratingCounts[1],
        rating2Count: ratingCounts[2],
        rating3Count: ratingCounts[3],
        rating4Count: ratingCounts[4],
        rating5Count: ratingCounts[5],
      })
      .onConflictDoUpdate({
        target: variantReviewAggregate.variantId,
        set: {
          averageRating,
          reviewCount,
          rating1Count: ratingCounts[1],
          rating2Count: ratingCounts[2],
          rating3Count: ratingCounts[3],
          rating4Count: ratingCounts[4],
          rating5Count: ratingCounts[5],
          updatedAt: new Date(),
        },
      });

    // Update cache
    await this.cacheService.setAggregate(variantId, {
      variantId,
      averageRating,
      reviewCount,
      rating1Count: ratingCounts[1],
      rating2Count: ratingCounts[2],
      rating3Count: ratingCounts[3],
      rating4Count: ratingCounts[4],
      rating5Count: ratingCounts[5],
      updatedAt: new Date(),
    });

    this.logger.info(
      `Aggregate recomputed for variant ${variantId}: ${averageRating.toFixed(2)} avg, ${reviewCount} reviews`,
    );
  }

  /**
   * Get aggregate for a variant
   * Uses cache first, falls back to DB
   */
  async getAggregate(variantId: string): Promise<ReviewAggregateDto | null> {
    // Try cache first
    const cached = await this.cacheService.getAggregate(variantId);
    if (cached) {
      return cached;
    }

    // Get from database
    const [aggregate] = await this.db
      .select()
      .from(variantReviewAggregate)
      .where(eq(variantReviewAggregate.variantId, variantId))
      .limit(1);

    if (!aggregate) {
      return null;
    }

    const result: ReviewAggregateDto = {
      variantId: aggregate.variantId,
      averageRating: Number(aggregate.averageRating),
      reviewCount: aggregate.reviewCount,
      rating1Count: aggregate.rating1Count,
      rating2Count: aggregate.rating2Count,
      rating3Count: aggregate.rating3Count,
      rating4Count: aggregate.rating4Count,
      rating5Count: aggregate.rating5Count,
      updatedAt: aggregate.updatedAt,
    };

    // Cache it
    await this.cacheService.setAggregate(variantId, result);

    return result;
  }
}
