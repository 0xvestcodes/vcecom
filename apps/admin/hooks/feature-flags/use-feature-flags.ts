"use client";

import { endpoints } from "@/lib/endpoints";
import { useApiQuery } from "../use-api-query";

export interface FeatureFlagActiveScope {
  type: "admin" | "store" | "environment";
  id: string;
}

export interface FeatureFlag {
  key: string;
  description: string;
  type: string;
  defaultState: boolean;
  currentState: boolean;
  activeScope?: FeatureFlagActiveScope;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagsResponse {
  flags: FeatureFlag[];
}

export interface FeatureFlagHistoryEntry {
  id: string;
  featureKey: string;
  scopeType?: string;
  scopeId?: string;
  oldState?: boolean;
  newState: boolean;
  changedBy: string;
  changeReason?: string;
  createdAt: Date;
}

export interface FeatureFlagHistoryResponse {
  history: FeatureFlagHistoryEntry[];
}

/**
 * Hook for fetching all feature flags
 *
 * @param params - Optional query parameters for context resolution
 * @returns Query result with feature flags data, loading state, and error state
 */
export function useFeatureFlags(params?: {
  adminId?: string;
  storeId?: string;
  env?: string;
}) {
  return useApiQuery<FeatureFlagsResponse>(endpoints.featureFlags.list, {
    params: params as Record<string, string | number | boolean | undefined>,
    enabled: true,
  });
}

/**
 * Hook for fetching resolved feature flags for current context
 *
 * @returns Query result with resolved feature flags
 */
export function useResolvedFeatureFlags() {
  return useApiQuery<FeatureFlagsResponse>(endpoints.featureFlags.resolve, {
    enabled: true,
  });
}

/**
 * Hook for fetching a single feature flag
 *
 * @param key - Feature flag key
 * @returns Query result with feature flag data
 */
export function useFeatureFlag(key: string) {
  const { data, ...rest } = useFeatureFlags();
  const flag = data?.flags.find((f) => f.key === key);

  return {
    data: flag,
    ...rest,
  };
}

/**
 * Hook for fetching feature flag history
 *
 * @param key - Feature flag key
 * @param scopeType - Optional scope type filter
 * @param scopeId - Optional scope ID filter
 * @returns Query result with audit history
 */
export function useFeatureFlagHistory(
  key: string,
  scopeType?: string,
  scopeId?: string,
) {
  return useApiQuery<FeatureFlagHistoryResponse>(
    endpoints.featureFlags.history(key, scopeType, scopeId),
    {
      enabled: !!key,
    },
  );
}
