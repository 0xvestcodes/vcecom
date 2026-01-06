"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type FetchError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";

export interface CreateFeatureFlagDto {
  key: string;
  description: string;
  type?: "global" | "store" | "admin" | "env";
  defaultState?: boolean;
}

export interface SetFeatureFlagDto {
  state: boolean;
  reason?: string;
}

/**
 * Hook for creating a new feature flag
 */
export function useCreateFeatureFlag() {
  const queryClient = useQueryClient();

  return useApiMutation<
    { key: string; description: string; type: string; defaultState: boolean },
    CreateFeatureFlagDto,
    FetchError
  >({
    mutationFn: async (dto: CreateFeatureFlagDto) => {
      return api.post(endpoints.featureFlags.create, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.featureFlags.list],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.featureFlags.resolve],
      });
      toast.success("Feature flag created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create feature flag");
    },
  });
}

/**
 * Hook for updating feature flag default state
 */
export function useUpdateFeatureFlagDefaultState() {
  const queryClient = useQueryClient();

  return useApiMutation<
    {
      key: string;
      description: string;
      type: string;
      defaultState: boolean;
      currentState: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    { key: string; state: boolean; reason?: string },
    FetchError
  >({
    mutationFn: async ({ key, state, reason }) => {
      return api.patch(endpoints.featureFlags.updateDefaultState(key), {
        state,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.featureFlags.list],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.featureFlags.resolve],
      });
      toast.success("Feature flag default state updated");
    },
    onError: (error) => {
      toast.error(
        error.message || "Failed to update feature flag default state",
      );
    },
  });
}

/**
 * Hook for toggling a feature flag state
 */
export function useToggleFeatureFlag() {
  const queryClient = useQueryClient();

  return useApiMutation<
    { message: string },
    { key: string; state: boolean; reason?: string },
    FetchError
  >({
    mutationFn: async ({ key, state, reason }) => {
      const endpoint = state
        ? endpoints.featureFlags.enable(key)
        : endpoints.featureFlags.disable(key);
      return api.post(endpoint, { state, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.featureFlags.list],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.featureFlags.resolve],
      });
      toast.success("Feature flag updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update feature flag");
    },
  });
}

/**
 * Hook for setting a feature flag scope override
 */
export function useSetFeatureFlagScope() {
  const queryClient = useQueryClient();

  return useApiMutation<
    { message: string },
    {
      key: string;
      scopeType: "admin" | "store" | "environment";
      scopeId: string;
      state: boolean;
      reason?: string;
    },
    FetchError
  >({
    mutationFn: async ({ key, scopeType, scopeId, state, reason }) => {
      let endpoint: string;
      if (scopeType === "admin") {
        endpoint = endpoints.featureFlags.setAdminScope(key, scopeId);
      } else if (scopeType === "store") {
        endpoint = endpoints.featureFlags.setStoreScope(key, scopeId);
      } else {
        endpoint = endpoints.featureFlags.setEnvScope(key, scopeId);
      }

      return api.post(endpoint, { state, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.featureFlags.list],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.featureFlags.resolve],
      });
      toast.success("Feature flag override set");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to set feature flag override");
    },
  });
}

/**
 * Hook for removing a feature flag scope override
 */
export function useRemoveFeatureFlagScope() {
  const queryClient = useQueryClient();

  return useApiMutation<
    { message: string },
    {
      key: string;
      scopeType: "admin" | "store" | "environment";
      scopeId: string;
      reason?: string;
    },
    FetchError
  >({
    mutationFn: async ({ key, scopeType, scopeId, reason }) => {
      const url = endpoints.featureFlags.removeScope(key, scopeType, scopeId);
      const queryParams = reason ? `?reason=${encodeURIComponent(reason)}` : "";
      return api.delete(`${url}${queryParams}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.featureFlags.list],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.featureFlags.resolve],
      });
      toast.success("Feature flag override removed");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove feature flag override");
    },
  });
}
