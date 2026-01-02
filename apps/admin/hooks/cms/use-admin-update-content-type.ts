"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { ContentType, UpdateContentTypeDto } from "@/lib/types/cms";
import { useApiMutation } from "../use-api-mutation";

/**
 * Hook for updating a content type
 */
export function useAdminUpdateContentType(contentTypeId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<ContentType, UpdateContentTypeDto>({
    mutationFn: async (data) => {
      const response = await api.put<ContentType>(
        endpoints.cms.contentTypes.update(contentTypeId),
        data,
      );
      return response;
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.contentTypes.list],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.contentTypes.detail(contentTypeId)],
      });
      toast.success("Content type updated successfully");
    },
    onError: (error) => {
      toast.error(
        error.message || "Failed to update content type. Please try again.",
      );
    },
  });
}
