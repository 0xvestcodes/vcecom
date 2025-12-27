"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PaginationControls } from "@/components/common/pagination-controls";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { useAdminActivityLogs } from "@/hooks/activity-logs/use-admin-activity-logs";
import type { ActivityLogQueryParams } from "@/lib/types/activity-logs";
import { ActivityLogsFilters } from "./activity-logs-filters";
import { ActivityLogsTable } from "./activity-logs-table";

function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): ActivityLogQueryParams {
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");

  return {
    page: pageParam ? parseInt(pageParam, 10) : undefined,
    limit: limitParam ? parseInt(limitParam, 10) : undefined,
    adminId: searchParams.get("adminId") || undefined,
    action: searchParams.get("action") || undefined,
    resource: searchParams.get("resource") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    search: searchParams.get("search") || undefined,
  };
}

export function ActivityLogsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<ActivityLogQueryParams>(
    parseFiltersFromSearchParams(searchParams),
  );

  const { data, isLoading, error } = useAdminActivityLogs(filters);

  // Sync filters to URL - skip initial mount to prevent infinite loops
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Skip on initial mount - filters are already synced from URL
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (filters.page && filters.page > 1) {
      params.set("page", filters.page.toString());
    }
    if (filters.limit && filters.limit !== 10) {
      params.set("limit", filters.limit.toString());
    }
    if (filters.adminId) params.set("adminId", filters.adminId);
    if (filters.action) params.set("action", filters.action);
    if (filters.resource) params.set("resource", filters.resource);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.search) params.set("search", filters.search);

    const newSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, "");

    // Only update URL if it actually changed
    if (newSearch !== currentSearch) {
      router.replace(`/activity-logs${newSearch ? `?${newSearch}` : ""}`, {
        scroll: false,
      });
    }
  }, [filters, router]);

  const handleFiltersChange = (newFilters: ActivityLogQueryParams) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      page: 1,
      limit: 10,
    });
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const paginationData = data
    ? {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
        hasNextPage: data.page < data.totalPages,
        hasPreviousPage: data.page > 1,
      }
    : undefined;

  return (
    <AdminPageLayout
      title="Activity Logs"
      description="Monitor and audit admin activity across the platform"
    >
      <div className="space-y-4">
        <ActivityLogsFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClear={handleClearFilters}
        />

        {error && (
          <div className="p-4 border border-destructive rounded-lg bg-destructive/10 text-destructive">
            Error loading activity logs: {error.message}
          </div>
        )}

        <ActivityLogsTable logs={data?.data || []} isLoading={isLoading} />

        {paginationData && paginationData.totalPages > 1 && (
          <PaginationControls
            paginationInfo={{
              startItem: (paginationData.page - 1) * paginationData.limit + 1,
              endItem: Math.min(
                paginationData.page * paginationData.limit,
                paginationData.total,
              ),
              total: paginationData.total,
              currentPage: paginationData.page,
              totalPages: paginationData.totalPages,
            }}
            onPreviousPage={() => handlePageChange(paginationData.page - 1)}
            onNextPage={() => handlePageChange(paginationData.page + 1)}
            canGoPrevious={paginationData.hasPreviousPage}
            canGoNext={paginationData.hasNextPage}
            isLoading={isLoading}
            itemLabel="logs"
          />
        )}

        {data && data.total === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
            <p className="text-sm font-medium mb-1">No activity logs found</p>
            <p className="text-xs">
              Activity logs will appear here as admins perform actions
            </p>
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
