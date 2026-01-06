"use client";

import { endpoints } from "@/lib/endpoints";
import { useApiQuery } from "../use-api-query";

export interface AbandonedCartAnalyticsQueryParams {
  startDate?: string;
  endDate?: string;
  minValue?: number;
  customerId?: string;
}

export interface AbandonedCartAnalytics {
  abandonedOverTime: Array<{
    date: string;
    count: number;
    totalValue: number;
  }>;
  recoveryRateOverTime: Array<{
    date: string;
    recoveryRate: number;
  }>;
  recoveryAttemptsBreakdown: {
    emailSent: number;
    smsSent: number;
    recovered: number;
    expired: number;
    failed: number;
  };
  topAbandonedProducts: Array<{
    productId: string;
    productName: string;
    abandonCount: number;
  }>;
}

export function useAbandonedCartAnalytics(
  params?: AbandonedCartAnalyticsQueryParams,
) {
  const queryString = params
    ? new URLSearchParams(
        Object.entries(params).reduce(
          (acc, [key, value]) => {
            if (value !== undefined && value !== null) {
              acc[key] = String(value);
            }
            return acc;
          },
          {} as Record<string, string>,
        ),
      ).toString()
    : "";

  return useApiQuery<AbandonedCartAnalytics>(
    `${endpoints.abandonedCarts.analytics}${queryString ? `?${queryString}` : ""}`,
    {
      enabled: true,
    },
  );
}
