"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";

/**
 * Hook for deleting a content type
 */
export function useAdminDeleteContentType() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useApiMutation<void, string>({
    mutationFn: async (contentTypeId) => {
      await api.delete(endpoints.cms.contentTypes.delete(contentTypeId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.contentTypes.list],
      });
      toast.success("Content type deleted successfully");
      router.push("/cms/content-types");
    },
    onError: (error) => {
      toast.error(
        error.message || "Failed to delete content type. Please try again.",
      );
    },
  });
}
