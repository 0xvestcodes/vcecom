import { ApiProperty } from "@nestjs/swagger";

export class ReviewResponseDto {
  @ApiProperty({
    description: "Review ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Customer ID who wrote the review",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  customerId: string;

  @ApiProperty({
    description: "Customer name",
    example: "John Doe",
  })
  customerName: string;

  @ApiProperty({
    description: "Order ID (verified purchase)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  orderId: string;

  @ApiProperty({
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  variantId: string;

  @ApiProperty({
    description: "Rating (1-5)",
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  rating: number;

  @ApiProperty({
    description: "Review title",
    example: "Great product!",
    required: false,
  })
  title?: string | null;

  @ApiProperty({
    description: "Review body",
    example: "This product exceeded my expectations.",
  })
  body: string;

  @ApiProperty({
    description: "Array of image URLs",
    example: ["https://example.com/image1.jpg"],
    type: [String],
    required: false,
  })
  images?: string[] | null;

  @ApiProperty({
    description: "Review status",
    example: "approved",
    enum: ["pending", "approved", "rejected"],
  })
  status: "pending" | "approved" | "rejected";

  @ApiProperty({
    description: "Number of helpful votes",
    example: 10,
  })
  helpfulCount: number;

  @ApiProperty({
    description: "Whether current user has marked this as helpful",
    example: false,
  })
  isHelpful?: boolean;

  @ApiProperty({
    description: "Review creation timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Review last update timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  updatedAt: Date;
}

export class PaginatedReviewsResponseDto {
  @ApiProperty({
    description: "List of reviews",
    type: [ReviewResponseDto],
  })
  data: ReviewResponseDto[];

  @ApiProperty({
    description: "Total number of reviews",
    example: 50,
  })
  total: number;

  @ApiProperty({
    description: "Current page number",
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: "Number of items per page",
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: "Total number of pages",
    example: 3,
  })
  totalPages: number;
}
