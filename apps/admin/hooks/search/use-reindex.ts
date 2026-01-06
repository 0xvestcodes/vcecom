"use client";

import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";
import { useApiQuery } from "../use-api-query";

export enum ReindexEntityType {
  PRODUCTS = "products",
  COLLECTIONS = "collections",
  ALL = "all",
}

export interface ReindexRequest {
  entityType?: ReindexEntityType;
  categoryId?: string;
  collectionId?: string;
  dateFrom?: string;
  dateTo?: string;
  batchSize?: number;
}

export interface ReindexStatus {
  status: "idle" | "running" | "completed" | "failed";
  progress: {
    total: number;
    processed: number;
    failed: number;
    percentage: number;
  };
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface ReindexResponse {
  message: string;
  status: "started" | "running";
}

/**
 * Hook for fetching reindex status
 */
export function useReindexStatus() {
  return useApiQuery<ReindexStatus>(endpoints.search.reindexStatus, {
    enabled: true,
    refetchInterval: (query) => {
      // Poll every 2 seconds if reindex is running, otherwise every 30 seconds
      const data = query.state.data as ReindexStatus | undefined;
      return data?.status === "running" ? 2000 : 30000;
    },
  });
}

/**
 * Hook for triggering a reindex operation
 */
export function useTriggerReindex() {
  const queryClient = useQueryClient();

  return useApiMutation<ReindexResponse, ReindexRequest>({
    mutationFn: (data) =>
      api.post<ReindexResponse>(endpoints.search.reindex, data),
    onSuccess: () => {
      // Invalidate reindex status to refetch immediately
      queryClient.invalidateQueries({
        queryKey: [endpoints.search.reindexStatus],
      });
      // Also invalidate search stats
      queryClient.invalidateQueries({
        queryKey: [endpoints.search.status],
      });
    },
  });
}
