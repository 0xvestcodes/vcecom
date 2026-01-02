"use client";

import { useQueryClient } from "@tanstack/react-query";
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
import { useAdminDeletePriceList } from "@/hooks/pricing/use-admin-delete-price-list";
import { useAdminPriceLists } from "@/hooks/pricing/use-admin-price-lists";
import { usePagination } from "@/hooks/use-pagination";
import { endpoints } from "@/lib/endpoints";
import type { PriceList } from "@/lib/types/price-lists";
import { PaginationControls } from "../common/pagination-controls";
import { DateTime } from "../orders/date-time";
import { EmptyPriceListsState } from "./empty-price-lists-state";
import { PriceListSheet } from "./price-list-sheet";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Refactored Price Lists List Client using universal components
 * Follows L1 pattern: Header → Search + Filters → Table → Pagination
 */
export function PriceListsListClientRefactored() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [priceListSheetOpen, setPriceListSheetOpen] = useState(false);
  const [selectedPriceListId, setSelectedPriceListId] = useState<string | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceListToDelete, setPriceListToDelete] = useState<string | null>(
    null,
  );

  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [filters, setFilters] = useState(initialFilters);

  const {
    data: priceListsData,
    isLoading,
    error,
    refetch,
  } = useAdminPriceLists(filters);

  useSyncFiltersToUrl(filters, router);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const paginationData = priceListsData
    ? {
        page: priceListsData.page,
        limit: priceListsData.limit,
        total: priceListsData.total,
        totalPages: priceListsData.totalPages,
        hasNextPage: priceListsData.page < priceListsData.totalPages,
        hasPreviousPage: priceListsData.page > 1,
      }
    : undefined;

  const pagination = usePagination(paginationData, handlePageChange);

  const deletePriceList = useAdminDeletePriceList(priceListToDelete || "");

  const handleCreate = () => {
    setSelectedPriceListId(null);
    setPriceListSheetOpen(true);
  };

  const handleEdit = (priceListId: string) => {
    setSelectedPriceListId(priceListId);
    setPriceListSheetOpen(true);
  };

  const handleDeleteClick = (priceListId: string) => {
    setPriceListToDelete(priceListId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!priceListToDelete) return;

    try {
      await deletePriceList.mutateAsync();
      queryClient.invalidateQueries({ queryKey: [endpoints.priceLists.list] });
      toast.success("Price list deleted successfully");
      setDeleteDialogOpen(false);
      setPriceListToDelete(null);
    } catch (_error) {
      // Error handled by hook
    }
  };

  const handleClearFilters = useCallback(() => {
    setFilters({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
    });
  }, []);

  // Convert price lists to table format
  const columns: Column<PriceList>[] = [
    {
      id: "name",
      header: "Name",
      cell: (priceList) => (
        <span className="font-medium">{priceList.name}</span>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (priceList) => (
        <Badge variant="outline" className="text-xs">
          {priceList.type}
        </Badge>
      ),
    },
    {
      id: "customerGroups",
      header: "Customer Groups",
      cell: (priceList) =>
        priceList.customerGroupIds?.length
          ? `${priceList.customerGroupIds.length} groups`
          : "-",
    },
    {
      id: "overrides",
      header: "Overrides",
      cell: (priceList) =>
        priceList.items?.length ? `${priceList.items.length} items` : "0",
    },
    {
      id: "status",
      header: "Status",
      cell: (priceList) => (
        <Badge
          variant={priceList.isActive ? "default" : "secondary"}
          className="text-xs"
        >
          {priceList.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      cell: (priceList) => <DateTime date={priceList.createdAt} />,
    },
  ];

  const rowActions: RowAction<PriceList>[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (priceList) => handleEdit(priceList.id),
      roles: ["admin", "marketing"],
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (priceList) => handleDeleteClick(priceList.id),
      destructive: true,
      roles: ["admin", "marketing"],
    },
  ];

  // Filter definitions following the rule: Status → Category → Range → Sort
  const filterDefinitions = [
    {
      key: "status",
      label: "Status",
      type: "select" as const,
      options: [
        { value: "all", label: "All Statuses" },
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
    {
      key: "type",
      label: "Type",
      type: "select" as const,
      options: [
        { value: "all", label: "All Types" },
        { value: "B2C", label: "B2C" },
        { value: "B2B", label: "B2B" },
        { value: "WHOLESALE", label: "Wholesale" },
        { value: "RETAIL", label: "Retail" },
        { value: "CUSTOM", label: "Custom" },
      ],
    },
  ];

  const filterValues = {
    status:
      filters.isActive !== undefined
        ? filters.isActive
          ? "active"
          : "inactive"
        : "all",
    type: filters.type || "all",
  };

  const handleFiltersChange = (newFilters: Record<string, unknown>) => {
    setFilters((prev) => ({
      ...prev,
      isActive:
        newFilters.status === "all"
          ? undefined
          : newFilters.status === "active",
      type: newFilters.type === "all" ? undefined : (newFilters.type as string),
      page: DEFAULT_PAGE,
    }));
  };

  return (
    <>
      <ListLayout
        title="Price Lists"
        description="Manage price lists for customer groups"
        searchPlaceholder="Search price lists..."
        searchValue={filters.search || ""}
        onSearchChange={(value) =>
          setFilters((prev) => ({
            ...prev,
            search: value || undefined,
            page: DEFAULT_PAGE,
          }))
        }
        createButton={
          <ProtectedButton requiredRoles={["admin", "marketing"]}>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Price List
            </Button>
          </ProtectedButton>
        }
        filters={filterDefinitions}
        filterValues={filterValues}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        pagination={
          <PaginationControls
            paginationInfo={pagination.paginationInfo}
            onPreviousPage={pagination.handlePreviousPage}
            onNextPage={pagination.handleNextPage}
            canGoPrevious={pagination.canGoPrevious}
            canGoNext={pagination.canGoNext}
            isLoading={isLoading}
            itemLabel="price lists"
          />
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={priceListsData}
          loadingComponent={
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          }
          emptyComponent={<EmptyPriceListsState onCreate={handleCreate} />}
          onRetry={() => refetch()}
        >
          <DataTable
            columns={columns}
            data={priceListsData?.data || []}
            rowActions={rowActions}
            onRowClick={(priceList) =>
              router.push(`/price-lists/${priceList.id}`)
            }
            emptyMessage="No price lists found"
            isLoading={isLoading}
          />
        </QueryState>
      </ListLayout>

      <PriceListSheet
        priceListId={selectedPriceListId}
        open={priceListSheetOpen}
        onOpenChange={(open) => {
          setPriceListSheetOpen(open);
          if (!open) {
            setSelectedPriceListId(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Price List"
        description="Are you sure you want to delete this price list? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deletePriceList.isPending}
      />
    </>
  );
}

/**
 * Parses search parameters from URL
 */
function parseFiltersFromSearchParams(searchParams: URLSearchParams) {
  return {
    page: parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10),
    limit: parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    search: searchParams.get("search") || undefined,
    isActive:
      searchParams.get("isActive") === "true"
        ? true
        : searchParams.get("isActive") === "false"
          ? false
          : undefined,
    type: searchParams.get("type") || undefined,
  };
}

/**
 * Hook to sync filters to URL
 */
function useSyncFiltersToUrl(
  filters: ReturnType<typeof parseFiltersFromSearchParams>,
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
    if (filters.search) urlParams.set("search", filters.search);
    if (filters.isActive !== undefined) {
      urlParams.set("isActive", filters.isActive.toString());
    }
    if (filters.type) urlParams.set("type", filters.type);

    router.replace(`/price-lists?${urlParams.toString()}`, { scroll: false });
  }, [filters, router]);
}
