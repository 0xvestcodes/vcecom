import { ProductsListClientRefactored } from "@/components/products/products-list-client-refactored";

/**
 * Products page - Server component
 * Delegates all client-side logic to ProductsListClientRefactored component
 */
export default function ProductsPage() {
  return <ProductsListClientRefactored />;
}
