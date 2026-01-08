"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";

export function useAdminDeleteMediaGroup() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useApiMutation<void, string>({
    mutationFn: async (id: string) => {
      return api.delete(endpoints.mediaGroups.delete(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.mediaGroups.list],
      });
      toast.success("Media group deleted successfully");
      router.push("/media-groups");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete media group");
    },
  });
}
