"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProtectedButton } from "@/components/common/protected-button";
import { QueryState } from "@/components/common/query-state";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { InventoryListSkeleton } from "@/components/skeletons/inventory-list-skeleton";
import { Button } from "@/components/ui/button";
import { useInventoryList } from "@/hooks/inventory/use-inventory-list";
import { usePagination } from "@/hooks/use-pagination";
import type { InventoryQueryParams } from "@/lib/types/inventory";
import { PaginationControls } from "../common/pagination-controls";
import { EmptyInventoryState } from "./empty-inventory-state";
import { InventoryFiltersBar } from "./inventory-filters-bar";
import { InventoryTable } from "./inventory-table";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_SORT_BY = "updatedAt";
const DEFAULT_SORT_ORDER = "desc";

function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): InventoryQueryParams {
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");

  return {
    page: pageParam ? parseInt(pageParam, 10) : DEFAULT_PAGE,
    limit: limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT,
    search: searchParams.get("search") || undefined,
    status:
      (searchParams.get("status") as InventoryQueryParams["status"]) ||
      undefined,
    lowStock: searchParams.get("lowStock") === "true" ? true : undefined,
    outOfStock: searchParams.get("outOfStock") === "true" ? true : undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    sortBy:
      (searchParams.get("sortBy") as InventoryQueryParams["sortBy"]) ||
      DEFAULT_SORT_BY,
    sortOrder:
      (searchParams.get("sortOrder") as "asc" | "desc") || DEFAULT_SORT_ORDER,
  };
}

function useSyncFiltersToUrl(
  filters: InventoryQueryParams,
  router: ReturnType<typeof useRouter>,
) {
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.page && filters.page !== DEFAULT_PAGE) {
      params.set("page", filters.page.toString());
    }
    if (filters.limit && filters.limit !== DEFAULT_LIMIT) {
      params.set("limit", filters.limit.toString());
    }
    if (filters.search) {
      params.set("search", filters.search);
    }
    if (filters.status) {
      params.set("status", filters.status);
    }
    if (filters.lowStock) {
      params.set("lowStock", "true");
    }
    if (filters.outOfStock) {
      params.set("outOfStock", "true");
    }
    if (filters.categoryId) {
      params.set("categoryId", filters.categoryId);
    }
    if (filters.sortBy && filters.sortBy !== DEFAULT_SORT_BY) {
      params.set("sortBy", filters.sortBy);
    }
    if (filters.sortOrder && filters.sortOrder !== DEFAULT_SORT_ORDER) {
      params.set("sortOrder", filters.sortOrder);
    }

    const newUrl = params.toString() ? `?${params.toString()}` : "";
    if (window.location.search !== newUrl) {
      router.replace(`/inventory${newUrl}`, { scroll: false });
    }
  }, [filters, router]);
}

/**
 * Client component for inventory list page
 * Handles all client-side logic including state management and interactions
 */
export function InventoryPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [inventoryFilters, setInventoryFilters] =
    useState<InventoryQueryParams>(initialFilters);

  const {
    data: inventoryData,
    isLoading,
    error,
  } = useInventoryList(inventoryFilters);

  useSyncFiltersToUrl(inventoryFilters, router);

  const handlePageChange = useCallback((newPage: number) => {
    setInventoryFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  // Transform inventory pagination to match usePagination expected format
  const paginationData = inventoryData
    ? {
        page: inventoryData.pagination.page,
        limit: inventoryData.pagination.limit,
        total: inventoryData.pagination.total,
        totalPages: inventoryData.pagination.totalPages,
        hasNextPage:
          inventoryData.pagination.page < inventoryData.pagination.totalPages,
        hasPreviousPage: inventoryData.pagination.page > 1,
      }
    : undefined;

  const pagination = usePagination(paginationData, handlePageChange);

  const handleClearFilters = useCallback(() => {
    setInventoryFilters({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      sortBy: DEFAULT_SORT_BY,
      sortOrder: DEFAULT_SORT_ORDER,
    });
  }, []);

  return (
    <AdminPageLayout
      title="Inventory"
      description="Manage inventory levels across all product variants"
      actions={
        <>
          <ProtectedButton requiredRoles={["admin"]}>
            <Button asChild variant="outline">
              <Link href="/inventory/bulk-adjust">
                <Plus className="mr-2 h-4 w-4" />
                Bulk Adjust
              </Link>
            </Button>
          </ProtectedButton>
          <ProtectedButton requiredRoles={["admin"]}>
            <Button asChild>
              <Link href="/inventory/settings">Settings</Link>
            </Button>
          </ProtectedButton>
        </>
      }
      filters={
        <InventoryFiltersBar
          filters={inventoryFilters}
          onFiltersChange={setInventoryFilters}
          onClear={handleClearFilters}
        />
      }
      pagination={
        <PaginationControls
          paginationInfo={pagination.paginationInfo}
          onPreviousPage={pagination.handlePreviousPage}
          onNextPage={pagination.handleNextPage}
          canGoPrevious={pagination.canGoPrevious}
          canGoNext={pagination.canGoNext}
          isLoading={isLoading}
          itemLabel="items"
        />
      }
    >
      <QueryState
        isLoading={isLoading}
        error={error}
        data={inventoryData}
        loadingComponent={<InventoryListSkeleton />}
        emptyComponent={<EmptyInventoryState />}
        onRetry={() => window.location.reload()}
      >
        {inventoryData && <InventoryTable items={inventoryData.data} />}
      </QueryState>
    </AdminPageLayout>
  );
}
