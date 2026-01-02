"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { Entry } from "@/lib/types/cms";
import { useApiMutation } from "../use-api-mutation";

/**
 * Hook for restoring an entry revision
 */
export function useAdminRestoreRevision(
  entryId: string,
  contentTypeId: string,
) {
  const queryClient = useQueryClient();

  return useApiMutation<Entry, string>({
    mutationFn: async (revisionId) => {
      const response = await api.post<Entry>(
        endpoints.cms.entries.restoreRevision(entryId, revisionId),
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.detail(entryId)],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.revisions(entryId)],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.list(contentTypeId)],
      });
      toast.success("Revision restored successfully");
    },
    onError: (error) => {
      toast.error(
        error.message || "Failed to restore revision. Please try again.",
      );
    },
  });
}
