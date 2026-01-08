"use client";

import { endpoints } from "@/lib/endpoints";
import type { MediaItem } from "@/lib/types/media-groups";
import { useApiQuery } from "../use-api-query";

export function useAdminMediaGroupItems(groupId: string, activeOnly?: boolean) {
  const params = activeOnly ? { activeOnly: "true" } : undefined;
  return useApiQuery<MediaItem[]>(endpoints.mediaGroups.items.list(groupId), {
    params,
    enabled: !!groupId,
  });
}
