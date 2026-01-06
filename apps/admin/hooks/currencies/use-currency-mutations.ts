"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, FetchError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type {
  CreateCurrencyDto,
  Currency,
  UpdateCurrencyDto,
} from "@/lib/types/currencies";
import { useApiMutation } from "../use-api-mutation";

/**
 * Hook for creating a new currency
 */
export function useCreateCurrency() {
  const queryClient = useQueryClient();

  return useApiMutation<Currency, CreateCurrencyDto>({
    mutationFn: (data) => api.post<Currency>(endpoints.currencies.create, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoints.currencies.list] });
      queryClient.invalidateQueries({
        queryKey: [endpoints.currencies.active],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.currencies.default],
      });
      toast.success("Currency created successfully");
    },
    onError: (error: FetchError) => {
      toast.error(error.message || "Failed to create currency");
    },
  });
}

/**
 * Hook for updating a currency
 */
export function useUpdateCurrency(id: string) {
  const queryClient = useQueryClient();

  return useApiMutation<Currency, UpdateCurrencyDto>({
    mutationFn: (data) =>
      api.patch<Currency>(endpoints.currencies.update(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoints.currencies.list] });
      queryClient.invalidateQueries({
        queryKey: [endpoints.currencies.active],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.currencies.default],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.currencies.detail(id)],
      });
      toast.success("Currency updated successfully");
    },
    onError: (error: FetchError) => {
      toast.error(error.message || "Failed to update currency");
    },
  });
}

/**
 * Hook for deleting a currency
 */
export function useDeleteCurrency() {
  const queryClient = useQueryClient();

  return useApiMutation<void, string>({
    mutationFn: (id) => api.delete<void>(endpoints.currencies.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoints.currencies.list] });
      queryClient.invalidateQueries({
        queryKey: [endpoints.currencies.active],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.currencies.default],
      });
      toast.success("Currency deleted successfully");
    },
    onError: (error: FetchError) => {
      toast.error(error.message || "Failed to delete currency");
    },
  });
}

/**
 * Hook for setting a currency as default
 */
export function useSetDefaultCurrency() {
  const queryClient = useQueryClient();

  return useApiMutation<Currency, string>({
    mutationFn: (id) => api.post<Currency>(endpoints.currencies.setDefault(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoints.currencies.list] });
      queryClient.invalidateQueries({
        queryKey: [endpoints.currencies.active],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.currencies.default],
      });
      toast.success("Default currency updated successfully");
    },
    onError: (error: FetchError) => {
      toast.error(error.message || "Failed to set default currency");
    },
  });
}
