"use client";

import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";
import { type Column, DataTable } from "@/components/common/data-table";
import { QueryState } from "@/components/common/query-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCustomerWallet,
  useWalletTransactions,
  type WalletTransaction,
} from "@/hooks/wallet/use-admin-wallet";
import {
  useCreditWallet,
  useDebitWallet,
} from "@/hooks/wallet/use-admin-wallet-mutations";

export function CustomerWalletDetailsClient({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const router = useRouter();
  const { customerId } = use(params);

  const { data: wallet, isLoading, error } = useCustomerWallet(customerId);
  const { data: transactions } = useWalletTransactions({
    customerId,
    limit: 50,
  });
  const creditWallet = useCreditWallet(customerId);
  const debitWallet = useDebitWallet(customerId);

  const [creditOpen, setCreditOpen] = useState(false);
  const [debitOpen, setDebitOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const handleCredit = () => {
    if (!amount || !description) {
      toast.error("Amount and description are required");
      return;
    }
    creditWallet.mutate(
      {
        amount: parseFloat(amount),
        description,
      },
      {
        onSuccess: () => {
          setCreditOpen(false);
          setAmount("");
          setDescription("");
        },
      },
    );
  };

  const handleDebit = () => {
    if (!amount || !description) {
      toast.error("Amount and description are required");
      return;
    }
    debitWallet.mutate(
      {
        amount: parseFloat(amount),
        description,
      },
      {
        onSuccess: () => {
          setDebitOpen(false);
          setAmount("");
          setDescription("");
        },
      },
    );
  };

  const transactionColumns: Column<WalletTransaction>[] = [
    {
      id: "type",
      header: "Type",
      cell: (tx) => (
        <span className="capitalize">{tx.type.replace("_", " ")}</span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      cell: (tx) =>
        tx.amount > 0
          ? `₹${tx.amount.toFixed(2)}`
          : tx.points > 0
            ? `${tx.points} pts`
            : "-",
    },
    {
      id: "description",
      header: "Description",
      cell: (tx) => tx.description,
    },
    {
      id: "balanceAfter",
      header: "Balance After",
      cell: (tx) => (
        <div>
          <div>₹{tx.balanceAfter.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">
            {tx.pointsAfter} pts
          </div>
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Date",
      cell: (tx) => new Date(tx.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <QueryState
        isLoading={isLoading}
        error={error}
        data={wallet}
        loadingComponent={<div>Loading...</div>}
        onRetry={() => window.location.reload()}
      >
        {wallet && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Wallet Balance</CardTitle>
                  <CardDescription>Store credits available</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    ₹{wallet.walletBalance.toFixed(2)}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Total Earned: ₹{wallet.totalEarned.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Redeemed: ₹{wallet.totalRedeemed.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Loyalty Points</CardTitle>
                  <CardDescription>Points balance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {wallet.loyaltyPoints.toLocaleString()}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Total Earned: {wallet.totalPointsEarned.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Redeemed:{" "}
                    {wallet.totalPointsRedeemed.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Wallet Actions</CardTitle>
                    <CardDescription>
                      Credit or debit customer wallet
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Credit Wallet
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Credit Wallet</DialogTitle>
                          <DialogDescription>
                            Add funds to customer wallet
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="credit-amount">Amount (₹)</Label>
                            <Input
                              id="credit-amount"
                              type="number"
                              step="0.01"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="credit-description">
                              Description
                            </Label>
                            <Textarea
                              id="credit-description"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Reason for credit..."
                            />
                          </div>
                          <Button
                            onClick={handleCredit}
                            disabled={creditWallet.isPending}
                            className="w-full"
                          >
                            {creditWallet.isPending
                              ? "Processing..."
                              : "Credit Wallet"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={debitOpen} onOpenChange={setDebitOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive">
                          <Minus className="mr-2 h-4 w-4" />
                          Debit Wallet
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Debit Wallet</DialogTitle>
                          <DialogDescription>
                            Remove funds from customer wallet
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="debit-amount">Amount (₹)</Label>
                            <Input
                              id="debit-amount"
                              type="number"
                              step="0.01"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="debit-description">
                              Description
                            </Label>
                            <Textarea
                              id="debit-description"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Reason for debit..."
                            />
                          </div>
                          <Button
                            onClick={handleDebit}
                            disabled={debitWallet.isPending}
                            variant="destructive"
                            className="w-full"
                          >
                            {debitWallet.isPending
                              ? "Processing..."
                              : "Debit Wallet"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  All wallet and points transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactions && (
                  <DataTable
                    columns={transactionColumns}
                    data={transactions.transactions}
                    emptyMessage="No transactions found"
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}
