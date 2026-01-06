"use client";

import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";
import { useApiQuery } from "../use-api-query";

export interface FieldWeights {
  title?: number;
  description?: number;
  sku?: number;
  tags?: number;
  collectionNames?: number;
}

export interface BoostFactors {
  popularity?: number;
  recency?: number;
  inventoryStatus?: number;
}

export interface RelevanceConfig {
  fieldWeights?: FieldWeights;
  boostFactors?: BoostFactors;
  synonyms?: Record<string, string[]>;
  stopWords?: string[];
  rankingRules?: string[];
  lastUpdatedAt?: string;
}

/**
 * Hook for fetching relevance configuration
 */
export function useRelevanceConfig() {
  return useApiQuery<RelevanceConfig>(endpoints.search.relevance, {
    enabled: true,
  });
}

/**
 * Hook for updating relevance configuration
 */
export function useUpdateRelevanceConfig() {
  const queryClient = useQueryClient();

  return useApiMutation<RelevanceConfig, Partial<RelevanceConfig>>({
    mutationFn: (data) =>
      api.put<RelevanceConfig>(endpoints.search.updateRelevance, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.search.relevance],
      });
    },
  });
}

/**
 * Hook for resetting relevance configuration to defaults
 */
export function useResetRelevanceConfig() {
  const queryClient = useQueryClient();

  return useApiMutation<RelevanceConfig, void>({
    mutationFn: () =>
      api.post<RelevanceConfig>(endpoints.search.resetRelevance),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.search.relevance],
      });
    },
  });
}

/**
 * Hook for syncing search indexes
 */
export function useSyncSearchIndexes() {
  const queryClient = useQueryClient();

  return useApiMutation<{ message: string }, void>({
    mutationFn: () => api.post<{ message: string }>(endpoints.search.sync),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.search.status],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.search.relevance],
      });
    },
  });
}
