"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { CreateEntryDto, Entry } from "@/lib/types/cms";
import { useApiMutation } from "../use-api-mutation";

/**
 * Hook for creating an entry
 */
export function useAdminCreateEntry(contentTypeId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useApiMutation<Entry, Omit<CreateEntryDto, "contentTypeId">>({
    mutationFn: async (data) => {
      const response = await api.post<Entry>(
        endpoints.cms.entries.create(contentTypeId),
        { ...data, contentTypeId },
      );
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.list(contentTypeId)],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.contentTypes.list],
      });
      toast.success("Entry created successfully");
      router.push(`/cms/entries/${data.id}/edit`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create entry. Please try again.");
    },
  });
}
