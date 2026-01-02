import { CustomersListClientRefactored } from "@/components/customers/customers-list-client-refactored";

/**
 * Customers page - Server component
 * Delegates all client-side logic to CustomersListClientRefactored component
 */
export default function CustomersPage() {
  return <CustomersListClientRefactored />;
}
