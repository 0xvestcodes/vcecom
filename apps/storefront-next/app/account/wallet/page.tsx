import { redirect } from "next/navigation";
import { getWalletBalance, getWalletTransactions } from "@/app/actions/wallet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WalletBalanceCard } from "@/components/wallet/wallet-balance-card";
import { WalletTransactionsList } from "@/components/wallet/wallet-transactions-list";
import { getCustomerSession } from "@/lib/server/auth";

export default async function WalletPage() {
  const session = await getCustomerSession();

  if (!session) {
    redirect("/login");
  }

  const [walletBalance, transactions] = await Promise.all([
    getWalletBalance(),
    getWalletTransactions({ limit: 50 }),
  ]);

  if (!walletBalance) {
    return (
      <div className="container py-10">
        <h1 className="text-3xl font-bold mb-8">My Wallet</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Unable to load wallet information. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">My Wallet</h1>

      <div className="mb-8">
        <WalletBalanceCard
          walletBalance={walletBalance.walletBalance}
          loyaltyPoints={walletBalance.loyaltyPoints}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            View all your wallet and loyalty point transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions && transactions.transactions.length > 0 ? (
            <WalletTransactionsList transactions={transactions.transactions} />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No transactions yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
