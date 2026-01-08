"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";

export function useAdminDeleteMediaItem(groupId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<void, string>({
    mutationFn: async (itemId: string) => {
      return api.delete(endpoints.mediaGroups.items.delete(itemId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.mediaGroups.items.list(groupId)],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.mediaGroups.detail(groupId)],
      });
      toast.success("Image deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete image");
    },
  });
}
