"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Column, DataTable } from "@/components/common/data-table";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Badge } from "@/components/ui/badge";
import { useAdminActivityLogs } from "@/hooks/activity-logs/use-admin-activity-logs";
import { usePagination } from "@/hooks/use-pagination";
import type {
  ActivityLog,
  ActivityLogQueryParams,
} from "@/lib/types/activity-logs";
import type { FilterDefinition } from "@/lib/types/filters";
import { PaginationControls } from "../common/pagination-controls";
import { DateTime } from "../orders/date-time";
import { EmptyActivityLogsState } from "./empty-activity-logs-state";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/**
 * Refactored Activity Logs List Client using universal components (L1 pattern)
 */
export function ActivityLogsListClientRefactored() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<ActivityLogQueryParams>(
    parseFiltersFromSearchParams(searchParams),
  );

  const { data, isLoading, error } = useAdminActivityLogs(filters);

  // Sync filters to URL - skip initial mount to prevent infinite loops
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (filters.page && filters.page > DEFAULT_PAGE) {
      params.set("page", filters.page.toString());
    }
    if (filters.limit && filters.limit !== DEFAULT_LIMIT) {
      params.set("limit", filters.limit.toString());
    }
    if (filters.adminId) params.set("adminId", filters.adminId);
    if (filters.action) params.set("action", filters.action);
    if (filters.resource) params.set("resource", filters.resource);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.search) params.set("search", filters.search);

    router.replace(
      `/activity-logs${params.toString() ? `?${params.toString()}` : ""}`,
      {
        scroll: false,
      },
    );
  }, [filters, router]);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

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

  const pagination = usePagination(paginationData, handlePageChange);

  const handleFiltersChange = (newFilters: ActivityLogQueryParams) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
    });
  };

  // Convert logs to table format
  const columns: Column<ActivityLog>[] = [
    {
      id: "timestamp",
      header: "Timestamp",
      cell: (log) => <DateTime date={log.createdAt} />,
    },
    {
      id: "admin",
      header: "Admin",
      cell: (log) => (
        <div>
          <div className="font-medium text-sm">
            {log.adminEmail || "Unknown"}
          </div>
          {log.adminId && (
            <div className="text-xs text-muted-foreground">{log.adminId}</div>
          )}
        </div>
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: (log) => (
        <Badge variant="outline" className="text-xs">
          {log.action}
        </Badge>
      ),
    },
    {
      id: "resource",
      header: "Resource",
      cell: (log) => log.resource || "-",
    },
    {
      id: "entityId",
      header: "Entity ID",
      cell: (log) => (
        <span className="font-mono text-xs">{log.entityId || "-"}</span>
      ),
    },
    {
      id: "userAgent",
      header: "User Agent",
      cell: (log) => (
        <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
          {log.userAgent || "-"}
        </span>
      ),
    },
  ];

  // Convert filters to FilterDefinition format
  const filterDefinitions: FilterDefinition[] = [
    {
      key: "adminId",
      label: "Admin",
      type: "select",
      options: [
        { value: "all", label: "All Admins" },
        // TODO: Add admin options from API
      ],
    },
    {
      key: "action",
      label: "Action",
      type: "select",
      options: [
        { value: "all", label: "All Actions" },
        { value: "product.create", label: "Product Created" },
        { value: "product.update", label: "Product Updated" },
        { value: "product.delete", label: "Product Deleted" },
        { value: "order.create", label: "Order Created" },
        { value: "order.update", label: "Order Updated" },
        { value: "admin.login", label: "Login" },
        { value: "admin.logout", label: "Logout" },
      ],
    },
    {
      key: "resource",
      label: "Resource",
      type: "select",
      options: [
        { value: "all", label: "All Resources" },
        { value: "product", label: "Product" },
        { value: "order", label: "Order" },
        { value: "customer", label: "Customer" },
        { value: "discount", label: "Discount" },
      ],
    },
  ];

  const filterValues: Record<string, unknown> = {
    adminId: filters.adminId || "all",
    action: filters.action || "all",
    resource: filters.resource || "all",
  };

  return (
    <ListLayout
      title="Activity Logs"
      description="Monitor and audit admin activity across the platform"
      filters={filterDefinitions}
      filterValues={filterValues}
      onFiltersChange={(newValues) => {
        handleFiltersChange({
          ...filters,
          adminId:
            newValues.adminId === "all"
              ? undefined
              : (newValues.adminId as string),
          action:
            newValues.action === "all"
              ? undefined
              : (newValues.action as string),
          resource:
            newValues.resource === "all"
              ? undefined
              : (newValues.resource as string),
        });
      }}
      onClearFilters={handleClearFilters}
      pagination={
        paginationData && paginationData.totalPages > 1 ? (
          <PaginationControls
            paginationInfo={pagination.paginationInfo}
            onPreviousPage={pagination.handlePreviousPage}
            onNextPage={pagination.handleNextPage}
            canGoPrevious={pagination.canGoPrevious}
            canGoNext={pagination.canGoNext}
            isLoading={isLoading}
            itemLabel="logs"
          />
        ) : null
      }
    >
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        loadingComponent={
          <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
        }
        emptyComponent={<EmptyActivityLogsState />}
        onRetry={() => window.location.reload()}
      >
        {data && (
          <DataTable<ActivityLog>
            columns={columns}
            data={data.data}
            emptyMessage="No activity logs found"
            isLoading={isLoading}
          />
        )}
      </QueryState>
    </ListLayout>
  );
}

/**
 * Parses search parameters from URL into ActivityLogQueryParams
 */
function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): ActivityLogQueryParams {
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  return {
    page: pageParam ? parseInt(pageParam, 10) : DEFAULT_PAGE,
    limit: limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT,
    adminId: searchParams.get("adminId") || undefined,
    action: searchParams.get("action") || undefined,
    resource: searchParams.get("resource") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    search: searchParams.get("search") || undefined,
  };
}
