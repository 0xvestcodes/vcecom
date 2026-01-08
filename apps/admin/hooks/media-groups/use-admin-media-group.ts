"use client";

import { endpoints } from "@/lib/endpoints";
import type { MediaGroup } from "@/lib/types/media-groups";
import { useApiQuery } from "../use-api-query";

export function useAdminMediaGroup(id: string) {
  return useApiQuery<MediaGroup>(endpoints.mediaGroups.detail(id), {
    enabled: !!id,
  });
}
