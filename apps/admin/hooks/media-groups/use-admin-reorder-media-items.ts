"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { MediaItem, ReorderItemsInput } from "@/lib/types/media-groups";
import { useApiMutation } from "../use-api-mutation";

export function useAdminReorderMediaItems(groupId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<MediaItem[], ReorderItemsInput>({
    mutationFn: async (data) => {
      return api.put<MediaItem[]>(
        endpoints.mediaGroups.items.reorder(groupId),
        data,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.mediaGroups.items.list(groupId)],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.mediaGroups.detail(groupId)],
      });
      toast.success("Items reordered successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reorder items");
    },
  });
}
