"use client";

import { endpoints } from "@/lib/endpoints";
import type {
  MediaGroupQueryParams,
  PaginatedMediaGroupsResponse,
} from "@/lib/types/media-groups";
import { useApiQuery } from "../use-api-query";

export function useAdminMediaGroups(params?: MediaGroupQueryParams) {
  return useApiQuery<PaginatedMediaGroupsResponse>(endpoints.mediaGroups.list, {
    params: params as Record<string, string | number | boolean | undefined>,
    enabled: true,
  });
}
