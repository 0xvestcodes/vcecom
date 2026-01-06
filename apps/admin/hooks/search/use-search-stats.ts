"use client";

import { endpoints } from "@/lib/endpoints";
import { useApiQuery } from "../use-api-query";

export interface SearchIndexStats {
  indexName: string;
  totalDocuments: number;
  indexSizeMb: number;
  lastUpdate: string;
}

export interface SearchStatsResponse {
  provider: string;
  indexes: SearchIndexStats[];
}

/**
 * Hook for fetching search index statistics
 */
export function useSearchStats() {
  return useApiQuery<SearchStatsResponse>(endpoints.search.status, {
    enabled: true,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
