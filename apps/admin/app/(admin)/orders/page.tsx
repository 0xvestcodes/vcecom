import { OrdersListClientRefactored } from "@/components/orders/orders-list-client-refactored";

/**
 * Orders page - Server component
 * Delegates all client-side logic to OrdersListClientRefactored component
 */
export default function OrdersPage() {
  return <OrdersListClientRefactored />;
}
