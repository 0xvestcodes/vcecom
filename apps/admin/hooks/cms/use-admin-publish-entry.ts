"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { Entry } from "@/lib/types/cms";
import { useApiMutation } from "../use-api-mutation";

/**
 * Hook for publishing an entry
 */
export function useAdminPublishEntry(entryId: string, contentTypeId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<Entry, void>({
    mutationFn: async () => {
      const response = await api.post<Entry>(
        endpoints.cms.entries.publish(entryId),
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.detail(entryId)],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.list(contentTypeId)],
      });
      toast.success("Entry published successfully");
    },
    onError: (error) => {
      toast.error(
        error.message || "Failed to publish entry. Please try again.",
      );
    },
  });
}

/**
 * Hook for unpublishing an entry
 */
export function useAdminUnpublishEntry(entryId: string, contentTypeId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<Entry, void>({
    mutationFn: async () => {
      const response = await api.post<Entry>(
        endpoints.cms.entries.unpublish(entryId),
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.detail(entryId)],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.list(contentTypeId)],
      });
      toast.success("Entry unpublished successfully");
    },
    onError: (error) => {
      toast.error(
        error.message || "Failed to unpublish entry. Please try again.",
      );
    },
  });
}
