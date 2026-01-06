"use client";

import { endpoints } from "@/lib/endpoints";
import { useApiQuery } from "../use-api-query";

export interface AbandonedCartStats {
  totalAbandoned: number;
  totalRecovered: number;
  recoveryRate: number;
  totalRevenueRecovered: number;
  averageCartValue: number;
  averageRecoveryTime: number;
}

export function useAbandonedCartStats() {
  return useApiQuery<AbandonedCartStats>(endpoints.abandonedCarts.stats, {
    refetchInterval: 60000, // Refetch every minute
  });
}
