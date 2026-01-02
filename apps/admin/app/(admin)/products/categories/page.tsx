import { CategoriesListClientRefactored } from "@/components/categories/categories-list-client-refactored";

/**
 * Categories page - Server component
 * Delegates all client-side logic to CategoriesListClientRefactored component
 */
export default function CategoriesPage() {
  return <CategoriesListClientRefactored />;
}
