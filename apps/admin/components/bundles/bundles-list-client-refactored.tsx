"use client";

import { Edit, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { ProtectedButton } from "@/components/common/protected-button";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminBundles } from "@/hooks/bundles/use-admin-bundles";
import { useAdminDeleteBundle } from "@/hooks/bundles/use-admin-delete-bundle";
import { usePagination } from "@/hooks/use-pagination";
import type { Bundle, BundleQueryParams } from "@/lib/types/bundles";
import { PaginationControls } from "../common/pagination-controls";
import { DateTime } from "../orders/date-time";
import { BundleSheet } from "./bundle-sheet";
import { EmptyBundlesState } from "./empty-bundles-state";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/**
 * Refactored Bundles List Client using universal components (L1 pattern)
 */
export function BundlesListClientRefactored() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bundleSheetOpen, setBundleSheetOpen] = useState(false);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<string | null>(null);

  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [filters, setFilters] = useState<BundleQueryParams>(initialFilters);

  const {
    data: bundlesData,
    isLoading,
    error,
    refetch,
  } = useAdminBundles(filters);

  useSyncFiltersToUrl(filters, router);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const paginationData = bundlesData
    ? {
        page: bundlesData.page,
        limit: bundlesData.limit,
        total: bundlesData.total,
        totalPages: bundlesData.totalPages,
        hasNextPage: bundlesData.page < bundlesData.totalPages,
        hasPreviousPage: bundlesData.page > 1,
      }
    : undefined;

  const pagination = usePagination(paginationData, handlePageChange);

  const deleteBundle = useAdminDeleteBundle();

  const handleCreate = () => {
    setSelectedBundleId(null);
    setBundleSheetOpen(true);
  };

  const handleEdit = (bundleId: string) => {
    setSelectedBundleId(bundleId);
    setBundleSheetOpen(true);
  };

  const handleDeleteClick = (bundleId: string) => {
    setBundleToDelete(bundleId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (bundleToDelete) {
      try {
        await deleteBundle.mutateAsync(bundleToDelete);
        toast.success("Bundle deleted successfully");
        setDeleteDialogOpen(false);
        setBundleToDelete(null);
      } catch (_error) {
        // Error handled by hook
      }
    }
  };

  const handleClearFilters = useCallback(() => {
    setFilters({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
    });
  }, []);

  // Convert bundles to table format
  const columns: Column<Bundle>[] = [
    {
      id: "title",
      header: "Title",
      cell: (bundle) => <span className="font-medium">{bundle.title}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (bundle) => (
        <Badge
          variant={bundle.isActive ? "default" : "secondary"}
          className="text-xs"
        >
          {bundle.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "sets",
      header: "Sets",
      cell: (bundle) => bundle.sets?.length || 0,
    },
    {
      id: "createdAt",
      header: "Created",
      cell: (bundle) => <DateTime date={bundle.createdAt} />,
    },
  ];

  const rowActions: RowAction<Bundle>[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (bundle) => handleEdit(bundle.id),
      roles: ["admin", "marketing"],
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (bundle) => handleDeleteClick(bundle.id),
      destructive: true,
      roles: ["admin", "marketing"],
    },
  ];

  return (
    <>
      <ListLayout
        title="Bundles"
        description="Manage product bundles"
        createButton={
          <ProtectedButton requiredRoles={["admin", "marketing"]}>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Bundle
            </Button>
          </ProtectedButton>
        }
        onClearFilters={handleClearFilters}
        pagination={
          <PaginationControls
            paginationInfo={pagination.paginationInfo}
            onPreviousPage={pagination.handlePreviousPage}
            onNextPage={pagination.handleNextPage}
            canGoPrevious={pagination.canGoPrevious}
            canGoNext={pagination.canGoNext}
            isLoading={isLoading}
            itemLabel="bundles"
          />
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={bundlesData}
          loadingComponent={
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          }
          emptyComponent={<EmptyBundlesState onCreate={handleCreate} />}
          onRetry={() => refetch()}
        >
          <DataTable
            columns={columns}
            data={bundlesData?.data || []}
            rowActions={rowActions}
            onRowClick={(bundle) => router.push(`/bundles/${bundle.id}`)}
            emptyMessage="No bundles found"
            isLoading={isLoading}
          />
        </QueryState>
      </ListLayout>

      <BundleSheet
        bundleId={selectedBundleId}
        open={bundleSheetOpen}
        onOpenChange={(open) => {
          setBundleSheetOpen(open);
          if (!open) {
            setSelectedBundleId(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Bundle"
        description="Are you sure you want to delete this bundle? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteBundle.isPending}
      />
    </>
  );
}

/**
 * Parses search parameters from URL into BundleQueryParams
 */
function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): BundleQueryParams {
  return {
    page: parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10),
    limit: parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
  };
}

/**
 * Hook to sync bundle filters to URL when they change
 */
function useSyncFiltersToUrl(
  filters: BundleQueryParams,
  router: ReturnType<typeof useRouter>,
) {
  useEffect(() => {
    const urlParams = new URLSearchParams();

    if (filters.page && filters.page > DEFAULT_PAGE) {
      urlParams.set("page", filters.page.toString());
    }
    if (filters.limit && filters.limit !== DEFAULT_LIMIT) {
      urlParams.set("limit", filters.limit.toString());
    }

    router.replace(`/bundles?${urlParams.toString()}`, { scroll: false });
  }, [filters, router]);
}
