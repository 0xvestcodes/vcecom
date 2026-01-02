"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useCallback, useState } from "react";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Badge } from "@/components/ui/badge";
import { usePagination } from "@/hooks/use-pagination";
import { apiFetch, FetchError } from "@/lib/api";
import type { FilterDefinition } from "@/lib/types/filters";
import { PaginationControls } from "../common/pagination-controls";
import { DateTime } from "../orders/date-time";
import { AuditLogSheet } from "./audit-log-sheet";
import { EmptyAuditLogsState } from "./empty-audit-logs-state";

interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  ipAddress?: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

interface AuditLogsFilters {
  resourceType?: string;
  adminId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Refactored Audit Logs List Client using universal components (L1 pattern)
 */
export function AuditLogsListClientRefactored() {
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [filters, setFilters] = useState<AuditLogsFilters>({});
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const limit = DEFAULT_LIMIT;

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery<AuditLogsResponse, FetchError>({
    queryKey: ["audit-logs", page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters.resourceType) {
        params.append("resourceType", filters.resourceType);
      }
      if (filters.adminId) {
        params.append("adminId", filters.adminId);
      }
      if (filters.action) {
        params.append("action", filters.action);
      }
      if (filters.startDate) {
        params.append("startDate", filters.startDate.toISOString());
      }
      if (filters.endDate) {
        params.append("endDate", filters.endDate.toISOString());
      }
      if (filters.search) {
        params.append("search", filters.search);
      }

      return apiFetch<AuditLogsResponse>(
        `/admin/audit-logs?${params.toString()}`,
      );
    },
  });

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const paginationData = data
    ? {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: Math.ceil(data.total / data.limit),
        hasNextPage: data.page < Math.ceil(data.total / data.limit),
        hasPreviousPage: data.page > 1,
      }
    : undefined;

  const pagination = usePagination(paginationData, handlePageChange);

  const handleFiltersChange = (newFilters: AuditLogsFilters) => {
    setFilters(newFilters);
    setPage(DEFAULT_PAGE);
  };

  const handleClearFilters = () => {
    setFilters({});
    setPage(DEFAULT_PAGE);
  };

  // Convert filters to FilterDefinition format
  const filterDefinitions: FilterDefinition[] = [
    {
      key: "resourceType",
      label: "Resource Type",
      type: "select",
      options: [
        { value: "all", label: "All Resources" },
        { value: "product", label: "Product" },
        { value: "order", label: "Order" },
        { value: "customer", label: "Customer" },
        { value: "discount", label: "Discount" },
        { value: "price-list", label: "Price List" },
      ],
    },
    {
      key: "action",
      label: "Action",
      type: "text",
      placeholder: "Filter by action...",
    },
  ];

  const filterValues: Record<string, unknown> = {
    resourceType: filters.resourceType || "all",
    action: filters.action || "",
  };

  // Convert logs to table format
  const columns: Column<AuditLog>[] = [
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
          <div className="font-medium text-sm">{log.adminEmail}</div>
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
      cell: (log) => (
        <div>
          <div className="font-medium text-sm">{log.resourceType}</div>
          {log.resourceId && (
            <div className="text-xs text-muted-foreground font-mono">
              {log.resourceId}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "ipAddress",
      header: "IP Address",
      cell: (log) => (
        <span className="font-mono text-xs">{log.ipAddress || "-"}</span>
      ),
    },
  ];

  const rowActions: RowAction<AuditLog>[] = [
    {
      label: "View Details",
      icon: <Eye className="h-4 w-4" />,
      onClick: (log) => setSelectedLogId(log.id),
      roles: ["admin"],
    },
  ];

  return (
    <>
      <ListLayout
        title="Audit Logs"
        description="Track all administrative actions and changes"
        searchPlaceholder="Search audit logs..."
        searchValue={filters.search || ""}
        onSearchChange={(value) =>
          setFilters((prev) => ({ ...prev, search: value || undefined }))
        }
        filters={filterDefinitions}
        filterValues={filterValues}
        onFiltersChange={(newValues) => {
          setFilters({
            ...filters,
            resourceType:
              newValues.resourceType === "all"
                ? undefined
                : (newValues.resourceType as string),
            action:
              newValues.action === ""
                ? undefined
                : (newValues.action as string),
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
          error={queryError}
          data={data}
          loadingComponent={
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          }
          emptyComponent={<EmptyAuditLogsState />}
          onRetry={() => window.location.reload()}
        >
          {data && (
            <DataTable
              columns={columns}
              data={data.logs}
              rowActions={rowActions}
              emptyMessage="No audit logs found"
              isLoading={isLoading}
            />
          )}
        </QueryState>
      </ListLayout>

      <AuditLogSheet
        logId={selectedLogId}
        open={!!selectedLogId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLogId(null);
          }
        }}
      />
    </>
  );
}
