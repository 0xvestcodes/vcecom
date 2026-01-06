"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  FraudRiskScoreDto,
  PaginatedFlaggedOrdersResponseDto,
  ReviewOrderDto,
} from "@/lib/types/fraud-detection";

export interface FlaggedOrdersFilters {
  page?: number;
  limit?: number;
}

/**
 * Hook for fetching flagged orders
 */
export function useFraudFlaggedOrders(filters: FlaggedOrdersFilters = {}) {
  return useQuery({
    queryKey: ["fraud-flagged-orders", filters],
    queryFn: async (): Promise<PaginatedFlaggedOrdersResponseDto> => {
      const params = new URLSearchParams();
      if (filters.page) params.set("page", filters.page.toString());
      if (filters.limit) params.set("limit", filters.limit.toString());

      const response = await api.get<PaginatedFlaggedOrdersResponseDto>(
        `/admin/fraud/flagged-orders?${params.toString()}`,
      );
      return response;
    },
  });
}

/**
 * Hook for reviewing an order
 */
export function useReviewOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      reviewData,
    }: {
      orderId: string;
      reviewData: ReviewOrderDto;
    }): Promise<void> => {
      await api.post(`/admin/fraud/orders/${orderId}/review`, reviewData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud-flagged-orders"] });
      toast.success("Order marked as reviewed successfully");
    },
    onError: (error) => {
      toast.error(`Failed to review order: ${error.message}`);
    },
  });
}

/**
 * Hook for getting risk score details
 */
export function useFraudRiskScore(orderId: string) {
  return useQuery({
    queryKey: ["fraud-risk-score", orderId],
    queryFn: async (): Promise<FraudRiskScoreDto> => {
      const response = await api.get<FraudRiskScoreDto>(
        `/admin/fraud/risk-scores/${orderId}`,
      );
      return response;
    },
    enabled: !!orderId,
  });
}
