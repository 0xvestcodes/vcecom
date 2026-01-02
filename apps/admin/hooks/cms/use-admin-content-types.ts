"use client";

import { endpoints } from "@/lib/endpoints";
import type { ContentType } from "@/lib/types/cms";
import { useApiQuery } from "../use-api-query";

/**
 * Hook for fetching all content types
 */
export function useAdminContentTypes() {
  return useApiQuery<ContentType[]>(endpoints.cms.contentTypes.list, {
    enabled: true,
  });
}

/**
 * Hook for fetching a single content type
 */
export function useAdminContentType(contentTypeId: string) {
  return useApiQuery<ContentType>(
    endpoints.cms.contentTypes.detail(contentTypeId),
    {
      enabled: !!contentTypeId,
    },
  );
}
