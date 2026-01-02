"use client";

import { endpoints } from "@/lib/endpoints";
import type {
  Entry,
  ListEntriesQueryParams,
  PaginatedEntriesResponse,
} from "@/lib/types/cms";
import { useApiQuery } from "../use-api-query";

/**
 * Hook for fetching paginated list of entries for a content type
 */
export function useAdminEntries(
  contentTypeId: string,
  params?: ListEntriesQueryParams,
) {
  return useApiQuery<PaginatedEntriesResponse>(
    endpoints.cms.entries.list(contentTypeId),
    {
      params: params as Record<string, string | number | boolean | undefined>,
      enabled: !!contentTypeId,
    },
  );
}

/**
 * Hook for fetching a single entry
 */
export function useAdminEntry(entryId: string) {
  return useApiQuery<Entry>(endpoints.cms.entries.detail(entryId), {
    enabled: !!entryId,
  });
}

/**
 * Hook for fetching entry revisions
 */
export function useAdminEntryRevisions(entryId: string) {
  return useApiQuery<Entry[]>(endpoints.cms.entries.revisions(entryId), {
    enabled: !!entryId,
  });
}
