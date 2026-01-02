"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";

/**
 * Hook for deleting an entry
 */
export function useAdminDeleteEntry(contentTypeId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useApiMutation<void, string>({
    mutationFn: async (entryId) => {
      await api.delete(endpoints.cms.entries.delete(entryId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.list(contentTypeId)],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.contentTypes.list],
      });
      toast.success("Entry deleted successfully");
      router.push(`/cms/content-types/${contentTypeId}/entries`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete entry. Please try again.");
    },
  });
}
