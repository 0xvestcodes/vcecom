"use client";

import { endpoints } from "@/lib/endpoints";
import { useApiQuery } from "../use-api-query";

export interface CmsDashboardData {
  recentEditsCount: number;
  draftsCount: number;
  draftsNeedingReviewCount: number;
  publishedCount: number;
  linkErrorsCount: number;
  linkWarningsCount: number;
  recentEdits: Array<{
    id: string;
    title: string;
    contentType: string;
    updatedAt: Date;
    updatedBy?: string;
    url: string;
  }>;
  draftsNeedingReview: Array<{
    id: string;
    title: string;
    contentType: string;
    status: "draft" | "review";
    url: string;
  }>;
}

/**
 * Hook for fetching CMS dashboard statistics
 */
export function useCmsDashboard() {
  return useApiQuery<CmsDashboardData>(
    endpoints.cms.dashboard?.stats || "/admin/cms/dashboard/stats",
    {
      enabled: true,
    },
  );
}
