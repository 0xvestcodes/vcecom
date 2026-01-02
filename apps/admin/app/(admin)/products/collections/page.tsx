import { CollectionsListClientRefactored } from "@/components/collections/collections-list-client-refactored";

/**
 * Collections page - Server component
 * Delegates all client-side logic to CollectionsListClientRefactored component
 */
export default function CollectionsPage() {
  return <CollectionsListClientRefactored />;
}
