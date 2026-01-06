"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { ProtectedButton } from "@/components/common/protected-button";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddToBlacklist,
  useFraudBlacklists,
  useRemoveFromBlacklist,
} from "@/hooks/fraud-detection/use-fraud-blacklists";
import { FetchError } from "@/lib/api";
import type { FraudBlacklistDto } from "@/lib/types/fraud-detection";
import { PaginationControls } from "../common/pagination-controls";
import { DateTime } from "../orders/date-time";
import { AddToBlacklistDialog } from "./add-to-blacklist-dialog";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

interface BlacklistFilters {
  type?: string;
  page: number;
  limit: number;
}

/**
 * Fraud Detection - Blacklist Management Component
 */
export function FraudBlacklistManagement() {
  const _queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [filters, setFilters] = useState<BlacklistFilters>({
    page: DEFAULT_PAGE,
    limit: DEFAULT_LIMIT,
  });

  const {
    data: blacklistData,
    isLoading,
    error,
    refetch,
  } = useFraudBlacklists(filters);

  const _addToBlacklistMutation = useAddToBlacklist();
  const removeFromBlacklistMutation = useRemoveFromBlacklist();

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handleTypeFilterChange = useCallback((type: string) => {
    setFilters((prev) => ({
      ...prev,
      type: type === "all" ? undefined : type,
      page: DEFAULT_PAGE,
    }));
  }, []);

  const handleDeleteClick = (entryId: string) => {
    setEntryToDelete(entryId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;

    removeFromBlacklistMutation.mutate(entryToDelete);
    setDeleteDialogOpen(false);
    setEntryToDelete(null);
  };

  const columns: Column<FraudBlacklistDto>[] = [
    {
      id: "type",
      header: "Type",
      accessorKey: "type",
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.type}
        </Badge>
      ),
    },
    {
      id: "value",
      header: "Value",
      accessorKey: "value",
      cell: (row) => <span className="font-mono text-sm">{row.value}</span>,
    },
    {
      id: "reason",
      header: "Reason",
      accessorKey: "reason",
      cell: (row) => row.reason || "—",
    },
    {
      id: "createdAt",
      header: "Created",
      accessorKey: "createdAt",
      cell: (row) => <DateTime date={row.createdAt} />,
    },
  ];

  const rowActions: RowAction<FraudBlacklistDto>[] = [
    {
      label: "Remove",
      icon: <Trash2 className="h-4 w-4" />,
      destructive: true,
      onClick: (row) => handleDeleteClick(row.id),
    },
  ];

  const paginationData = blacklistData
    ? {
        page: blacklistData.page,
        limit: blacklistData.limit,
        total: blacklistData.total,
        totalPages: blacklistData.totalPages,
        hasNextPage: blacklistData.page < blacklistData.totalPages,
        hasPreviousPage: blacklistData.page > 1,
      }
    : undefined;

  return (
    <ListLayout
      title="Fraud Blacklists"
      description="Manage blacklisted emails, phone numbers, and addresses"
      createButton={
        <ProtectedButton
          requiredRoles={["admin"]}
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add to Blacklist
        </ProtectedButton>
      }
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor="blacklist-type-filter"
              className="text-sm font-medium"
            >
              Type:
            </label>
            <Select
              value={filters.type || "all"}
              onValueChange={handleTypeFilterChange}
            >
              <SelectTrigger id="blacklist-type-filter" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="address">Address</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Table */}
        <QueryState
          isLoading={isLoading}
          error={error as FetchError | null}
          data={blacklistData}
          onRetry={refetch}
          isEmpty={(data) => !data || data.data.length === 0}
          emptyComponent={<div>No blacklist entries found</div>}
        >
          <DataTable
            columns={columns}
            data={blacklistData?.data || []}
            rowActions={rowActions}
          />
        </QueryState>

        {/* Pagination */}
        {paginationData && (
          <PaginationControls
            paginationInfo={
              paginationData
                ? {
                    startItem:
                      (paginationData.page - 1) * paginationData.limit + 1,
                    endItem: Math.min(
                      paginationData.page * paginationData.limit,
                      paginationData.total,
                    ),
                    total: paginationData.total,
                    currentPage: paginationData.page,
                    totalPages: paginationData.totalPages,
                  }
                : null
            }
            onPreviousPage={() => handlePageChange(paginationData.page - 1)}
            onNextPage={() => handlePageChange(paginationData.page + 1)}
            canGoPrevious={paginationData.hasPreviousPage}
            canGoNext={paginationData.hasNextPage}
          />
        )}

        {/* Add to Blacklist Dialog */}
        <AddToBlacklistDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSuccess={() => {
            setAddDialogOpen(false);
            refetch();
          }}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Remove from Blacklist"
          description="Are you sure you want to remove this entry from the blacklist? This action cannot be undone."
          confirmText="Remove"
          variant="destructive"
          onConfirm={handleDeleteConfirm}
          isLoading={removeFromBlacklistMutation.isPending}
        />
      </div>
    </ListLayout>
  );
}
