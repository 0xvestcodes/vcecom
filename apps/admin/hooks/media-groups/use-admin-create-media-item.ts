"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { CreateMediaItemInput, MediaItem } from "@/lib/types/media-groups";
import { useApiMutation } from "../use-api-mutation";

export function useAdminCreateMediaItem(groupId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<MediaItem, CreateMediaItemInput>({
    mutationFn: async (data) => {
      return api.post<MediaItem>(
        endpoints.mediaGroups.items.add(groupId),
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
      toast.success("Image added successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add image");
    },
  });
}
