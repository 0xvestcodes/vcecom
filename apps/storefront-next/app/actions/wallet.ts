"use server";

import { serverApiFetch } from "@/lib/server/api";

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
  type: string;
  amount: number;
  points: number;
  balanceAfter: number;
  pointsAfter: number;
  description: string;
  orderId?: string;
  refundId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface WalletTransactionsResponse {
  transactions: WalletTransaction[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get wallet balance for current customer
 */
export async function getWalletBalance(): Promise<WalletBalance | null> {
  try {
    const data = await serverApiFetch<WalletBalance>("/store/wallet/balance");
    return data;
  } catch (error) {
    console.error("Get wallet balance error:", error);
    return null;
  }
}

/**
 * Get wallet transaction history
 */
export async function getWalletTransactions(params?: {
  limit?: number;
  offset?: number;
}): Promise<WalletTransactionsResponse | null> {
  try {
    const data = await serverApiFetch<WalletTransactionsResponse>(
      "/store/wallet/transactions",
      { params },
    );
    return data;
  } catch (error) {
    console.error("Get wallet transactions error:", error);
    return null;
  }
}

/**
 * Redeem loyalty points
 */
export async function redeemPoints(
  points: number,
): Promise<{ error?: string; success?: boolean }> {
  try {
    await serverApiFetch("/store/wallet/redeem-points", {
      method: "POST",
      body: JSON.stringify({ points }),
    });
    return { success: true };
  } catch (error) {
    console.error("Redeem points error:", error);
    return {
      error: "Failed to redeem points. Please try again.",
    };
  }
}
