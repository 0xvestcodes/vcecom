"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { Entry, UpdateEntryDto } from "@/lib/types/cms";
import { useApiMutation } from "../use-api-mutation";

/**
 * Hook for updating an entry
 */
export function useAdminUpdateEntry(entryId: string, contentTypeId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<Entry, UpdateEntryDto>({
    mutationFn: async (data) => {
      const response = await api.put<Entry>(
        endpoints.cms.entries.update(entryId),
        data,
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
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.revisions(entryId)],
      });
      toast.success("Entry updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update entry. Please try again.");
    },
  });
}
