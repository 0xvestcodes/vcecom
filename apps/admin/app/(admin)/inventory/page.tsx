import { InventoryListClientRefactored } from "@/components/inventory/inventory-list-client-refactored";

/**
 * Inventory list page - Server component
 * Delegates all client-side logic to InventoryListClientRefactored component
 */
export default function InventoryPage() {
  return <InventoryListClientRefactored />;
}
