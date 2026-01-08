"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type {
  MediaGroup,
  UpdateMediaGroupInput,
} from "@/lib/types/media-groups";
import { useApiMutation } from "../use-api-mutation";

export function useAdminUpdateMediaGroup(id: string) {
  const queryClient = useQueryClient();

  return useApiMutation<MediaGroup, UpdateMediaGroupInput>({
    mutationFn: async (data) => {
      return api.put<MediaGroup>(endpoints.mediaGroups.update(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.mediaGroups.list],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.mediaGroups.detail(id)],
      });
      toast.success("Media group updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update media group");
    },
  });
}
