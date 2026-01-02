import { ReviewsListClientRefactored } from "@/components/reviews/reviews-list-client-refactored";

/**
 * Reviews page - Server component
 * Delegates all client-side logic to ReviewsListClientRefactored component
 */
export default function ReviewsPage() {
  return <ReviewsListClientRefactored />;
}
