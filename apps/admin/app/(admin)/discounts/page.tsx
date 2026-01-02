import { DiscountsListClientRefactored } from "@/components/discounts/discounts-list-client-refactored";

/**
 * Discounts page - Server component
 * Delegates all client-side logic to DiscountsListClientRefactored component
 */
export default function DiscountsPage() {
  return <DiscountsListClientRefactored />;
}
