"use client";

import { endpoints } from "@/lib/endpoints";
import { useApiQuery } from "../use-api-query";

export interface RecoveryCampaignStats {
  campaignId: string;
  totalCarts: number;
  emailsSent: number;
  smsSent: number;
  recovered: number;
  recoveryRate: number;
  totalRevenueRecovered: number;
}

export function useRecoveryCampaignStats() {
  return useApiQuery<RecoveryCampaignStats[]>(
    endpoints.abandonedCarts.recoveryStats,
    {
      refetchInterval: 60000, // Refetch every minute
    },
  );
}
