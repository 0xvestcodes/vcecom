"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { ContentType, CreateContentTypeDto } from "@/lib/types/cms";
import { useApiMutation } from "../use-api-mutation";

/**
 * Hook for creating a content type
 */
export function useAdminCreateContentType() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useApiMutation<ContentType, CreateContentTypeDto>({
    mutationFn: async (data) => {
      const response = await api.post<ContentType>(
        endpoints.cms.contentTypes.create,
        data,
      );
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.contentTypes.list],
      });
      toast.success("Content type created successfully");
      router.push(`/cms/content-types/${data.id}`);
    },
    onError: (error) => {
      toast.error(
        error.message || "Failed to create content type. Please try again.",
      );
    },
  });
}
