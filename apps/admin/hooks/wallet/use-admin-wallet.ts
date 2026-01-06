"use client";

import { endpoints } from "@/lib/endpoints";
import { useApiQuery } from "../use-api-query";

export interface WalletBalance {
  walletBalance: number;
  loyaltyPoints: number;
  totalEarned: number;
  totalRedeemed: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
}

export interface WalletTransaction {
  id: string;
  customerId: string;
  type: string;
  amount: number;
  points: number;
  balanceAfter: number;
  pointsAfter: number;
  orderId?: string;
  refundId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface WalletTransactionHistory {
  transactions: WalletTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export function useCustomerWallet(customerId: string) {
  return useApiQuery<WalletBalance>(endpoints.wallet.customer(customerId), {
    enabled: !!customerId,
  });
}

export function useWalletTransactions(params?: {
  limit?: number;
  offset?: number;
  customerId?: string;
  type?: string;
  orderId?: string;
}) {
  return useApiQuery<WalletTransactionHistory>(endpoints.wallet.transactions, {
    params,
  });
}
