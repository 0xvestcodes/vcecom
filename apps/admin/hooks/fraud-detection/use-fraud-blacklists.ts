"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  AddToBlacklistDto,
  FraudBlacklistDto,
  PaginatedBlacklistResponseDto,
} from "@/lib/types/fraud-detection";

export interface BlacklistFilters {
  type?: string;
  page?: number;
  limit?: number;
}

/**
 * Hook for fetching fraud blacklists
 */
export function useFraudBlacklists(filters: BlacklistFilters = {}) {
  return useQuery({
    queryKey: ["fraud-blacklists", filters],
    queryFn: async (): Promise<PaginatedBlacklistResponseDto> => {
      const params = new URLSearchParams();
      if (filters.type) params.set("type", filters.type);
      if (filters.page) params.set("page", filters.page.toString());
      if (filters.limit) params.set("limit", filters.limit.toString());

      const response = await api.get<PaginatedBlacklistResponseDto>(
        `/admin/fraud/blacklists?${params.toString()}`,
      );
      return response;
    },
  });
}

/**
 * Hook for adding to blacklist
 */
export function useAddToBlacklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddToBlacklistDto): Promise<FraudBlacklistDto> => {
      const response = await api.post<FraudBlacklistDto>(
        "/admin/fraud/blacklists",
        data,
      );
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["fraud-blacklists"] });
      toast.success(`Added ${data.type} to blacklist successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to add to blacklist: ${error.message}`);
    },
  });
}

/**
 * Hook for removing from blacklist
 */
export function useRemoveFromBlacklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/admin/fraud/blacklists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud-blacklists"] });
      toast.success("Removed from blacklist successfully");
    },
    onError: (error) => {
      toast.error(`Failed to remove from blacklist: ${error.message}`);
    },
  });
}
