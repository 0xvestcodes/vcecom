"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type {
  CreateMediaGroupInput,
  MediaGroup,
} from "@/lib/types/media-groups";
import { useApiMutation } from "../use-api-mutation";

export function useAdminCreateMediaGroup() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useApiMutation<MediaGroup, CreateMediaGroupInput>({
    mutationFn: async (data) => {
      return api.post<MediaGroup>(endpoints.mediaGroups.create, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.mediaGroups.list],
      });
      toast.success("Media group created successfully");
      router.push(`/media-groups/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create media group");
    },
  });
}
