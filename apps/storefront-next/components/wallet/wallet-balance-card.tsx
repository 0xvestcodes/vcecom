"use client";

import { Gift, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface WalletBalanceCardProps {
  walletBalance: number;
  loyaltyPoints: number;
}

export function WalletBalanceCard({
  walletBalance,
  loyaltyPoints,
}: WalletBalanceCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(walletBalance)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Store credits available
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Loyalty Points</CardTitle>
          <Gift className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loyaltyPoints.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Points available for redemption
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
