import { CustomerWalletDetailsClient } from "@/components/wallet/customer-wallet-details-client";

/**
 * Customer wallet details page - Server component
 */
export default function CustomerWalletPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  return <CustomerWalletDetailsClient params={params} />;
}
