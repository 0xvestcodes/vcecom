"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { MediaItem, UpdateMediaItemInput } from "@/lib/types/media-groups";
import { useApiMutation } from "../use-api-mutation";

export function useAdminUpdateMediaItem(itemId: string, groupId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<MediaItem, UpdateMediaItemInput>({
    mutationFn: async (data) => {
      return api.put<MediaItem>(
        endpoints.mediaGroups.items.update(itemId),
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
      toast.success("Image updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update image");
    },
  });
}
