import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { customers, eq } from "@vcecom/db";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewAggregateDto } from "./dto/review-aggregate.dto";
import { ReviewQueryDto } from "./dto/review-query.dto";
import { ReviewResponseDto } from "./dto/review-response.dto";
import { UpdateReviewDto } from "./dto/update-review.dto";
import { ReviewAggregationService } from "./services/review-aggregation.service";
import { ReviewsService } from "./services/reviews.service";

@ApiTags("store")
@Controller("store/products")
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly aggregationService: ReviewAggregationService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  @Public()
  @Get(":id/reviews")
  @RateLimit(RATE_LIMIT_PRESETS.REVIEWS_LISTING)
  @ApiOperation({
    summary: "Get reviews for a product variant",
    description:
      "Retrieve paginated reviews for a product variant. Supports filtering and sorting. Public endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Reviews retrieved successfully",
    type: [ReviewResponseDto],
  })
  async getReviews(
    @Param("id") variantId: string,
    @Query() query: ReviewQueryDto,
    @Request() req?: AuthenticatedRequest,
  ) {
    const customerId = req?.user?.userId
      ? await this.getCustomerId(req.user.userId)
      : undefined;
    return this.reviewsService.findByVariant(variantId, query, customerId);
  }

  @Public()
  @Get(":id/reviews/aggregate")
  @RateLimit(RATE_LIMIT_PRESETS.REVIEWS_LISTING)
  @ApiOperation({
    summary: "Get review aggregate for a product variant",
    description:
      "Get aggregated review statistics (average rating, counts) for a product variant. Uses Redis cache. Public endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Review aggregate retrieved successfully",
    type: ReviewAggregateDto,
  })
  @ApiNotFoundResponse({
    description: "No reviews found for this variant",
  })
  async getAggregate(@Param("id") variantId: string) {
    const aggregate = await this.aggregationService.getAggregate(variantId);
    if (!aggregate) {
      return {
        variantId,
        averageRating: 0,
        reviewCount: 0,
        rating1Count: 0,
        rating2Count: 0,
        rating3Count: 0,
        rating4Count: 0,
        rating5Count: 0,
        updatedAt: new Date(),
      };
    }
    return aggregate;
  }

  @Post(":id/reviews")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create a review",
    description:
      "Create a review for a product variant. Requires verified purchase (order must be delivered).",
  })
  @ApiParam({
    name: "id",
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiCreatedResponse({
    description: "Review created successfully",
    type: ReviewResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid request (e.g., order not delivered, already reviewed)",
  })
  @ApiUnauthorizedResponse({
    description: "Unauthorized",
  })
  async createReview(
    @Param("id") variantId: string,
    @Body() createReviewDto: CreateReviewDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<ReviewResponseDto> {
    const customerId = await this.getCustomerId(req.user.userId);
    // Override variantId from path
    createReviewDto.variantId = variantId;
    return this.reviewsService.create(customerId, createReviewDto);
  }

  @Get("reviews/:reviewId")
  @Public()
  @ApiOperation({
    summary: "Get a single review by ID",
    description: "Get a single review by its ID. Public endpoint.",
  })
  @ApiParam({
    name: "reviewId",
    description: "Review ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Review retrieved successfully",
    type: ReviewResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Review not found",
  })
  async getReview(
    @Param("reviewId") reviewId: string,
    @Request() req?: AuthenticatedRequest,
  ): Promise<ReviewResponseDto> {
    const customerId = req?.user?.userId
      ? await this.getCustomerId(req.user.userId)
      : undefined;
    return this.reviewsService.findOne(reviewId, customerId);
  }

  @Patch("reviews/:reviewId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update a review",
    description:
      "Update your own review. Only allowed within 30 days of creation and if not rejected.",
  })
  @ApiParam({
    name: "reviewId",
    description: "Review ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Review updated successfully",
    type: ReviewResponseDto,
  })
  @ApiForbiddenResponse({
    description: "You can only edit your own reviews",
  })
  @ApiBadRequestResponse({
    description: "Cannot edit (rejected or time limit exceeded)",
  })
  @ApiUnauthorizedResponse({
    description: "Unauthorized",
  })
  async updateReview(
    @Param("reviewId") reviewId: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<ReviewResponseDto> {
    const customerId = await this.getCustomerId(req.user.userId);
    return this.reviewsService.update(reviewId, customerId, updateReviewDto);
  }

  @Delete("reviews/:reviewId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete a review",
    description: "Delete your own review.",
  })
  @ApiParam({
    name: "reviewId",
    description: "Review ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Review deleted successfully",
  })
  @ApiForbiddenResponse({
    description: "You can only delete your own reviews",
  })
  @ApiUnauthorizedResponse({
    description: "Unauthorized",
  })
  async deleteReview(
    @Param("reviewId") reviewId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    const customerId = await this.getCustomerId(req.user.userId);
    return this.reviewsService.remove(reviewId, customerId);
  }

  @Post("reviews/:reviewId/helpful")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Mark review as helpful",
    description: "Mark a review as helpful (idempotent).",
  })
  @ApiParam({
    name: "reviewId",
    description: "Review ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Review marked as helpful",
    schema: {
      type: "object",
      properties: {
        helpful: { type: "boolean" },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Unauthorized",
  })
  async markHelpful(
    @Param("reviewId") reviewId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ helpful: boolean }> {
    const customerId = await this.getCustomerId(req.user.userId);
    return this.reviewsService.markHelpful(reviewId, customerId);
  }

  @Delete("reviews/:reviewId/helpful")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Remove helpful vote",
    description: "Remove your helpful vote from a review.",
  })
  @ApiParam({
    name: "reviewId",
    description: "Review ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Helpful vote removed",
  })
  @ApiUnauthorizedResponse({
    description: "Unauthorized",
  })
  async removeHelpful(
    @Param("reviewId") reviewId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ helpful: boolean }> {
    const customerId = await this.getCustomerId(req.user.userId);
    return this.reviewsService.removeHelpful(reviewId, customerId);
  }

  /**
   * Get customer ID from user ID
   */
  private async getCustomerId(userId: string): Promise<string> {
    const [customer] = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);

    if (!customer) {
      throw new NotFoundException("Customer profile not found");
    }

    return customer.id;
  }
}
