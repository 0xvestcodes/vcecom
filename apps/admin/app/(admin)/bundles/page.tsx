import { BundlesListClientRefactored } from "@/components/bundles/bundles-list-client-refactored";

/**
 * Bundles page - Server component
 * Delegates all client-side logic to BundlesListClientRefactored component
 */
export default function BundlesPage() {
  return <BundlesListClientRefactored />;
}
