/**
 * Review-related TypeScript types
 * Mapped from backend DTOs
 */

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface Review {
  id: string;
  productVariantId: string;
  customerId: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  productTitle?: string;
  productVariantTitle?: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedReviewsResponse {
  data: Review[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReviewQueryParams {
  page?: number;
  limit?: number;
  variantId?: string;
  customerId?: string;
  status?: ReviewStatus;
  minRating?: number;
  maxRating?: number;
}
