import { InventoryHealthPageClient } from "@/components/inventory/inventory-health-page-client";

/**
 * Inventory Health Monitoring page - Server component
 * Delegates all client-side logic to InventoryHealthPageClient component
 */
export default function InventoryHealthPage() {
  return <InventoryHealthPageClient />;
}
