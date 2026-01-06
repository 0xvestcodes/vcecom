"use client";

import { ArrowDown, ArrowUp, CreditCard, RefreshCw } from "lucide-react";
import type { WalletTransaction } from "@/app/actions/wallet";
import { formatCurrency } from "@/lib/utils";

interface WalletTransactionsListProps {
  transactions: WalletTransaction[];
}

export function WalletTransactionsList({
  transactions,
}: WalletTransactionsListProps) {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "credit":
      case "points_earned":
      case "refund":
      case "promotion":
        return <ArrowUp className="h-4 w-4 text-green-600" />;
      case "debit":
      case "points_redeemed":
        return <ArrowDown className="h-4 w-4 text-red-600" />;
      case "admin_adjustment":
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      default:
        return <CreditCard className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "credit":
      case "points_earned":
      case "refund":
      case "promotion":
        return "text-green-600";
      case "debit":
      case "points_redeemed":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const formatTransactionType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-start space-x-4 flex-1">
            <div className="mt-0.5">{getTransactionIcon(transaction.type)}</div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium">
                  {formatTransactionType(transaction.type)}
                </span>
                {transaction.orderId && (
                  <span className="text-xs text-muted-foreground">
                    Order #{transaction.orderId.slice(0, 8)}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {transaction.description}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(transaction.createdAt).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <div className="text-right">
            {transaction.amount > 0 && (
              <div
                className={`font-semibold ${getTransactionColor(transaction.type)}`}
              >
                {transaction.type.includes("debit") ||
                transaction.type === "points_redeemed"
                  ? "-"
                  : "+"}
                {formatCurrency(transaction.amount)}
              </div>
            )}
            {transaction.points > 0 && (
              <div
                className={`text-sm font-medium ${getTransactionColor(transaction.type)}`}
              >
                {transaction.type === "points_redeemed" ? "-" : "+"}
                {transaction.points.toLocaleString()} pts
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              Balance: {formatCurrency(transaction.balanceAfter)}
            </div>
            {transaction.pointsAfter > 0 && (
              <div className="text-xs text-muted-foreground">
                Points: {transaction.pointsAfter.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
