"use client";

import { formatDistanceToNow } from "date-fns";
import { Edit } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { InventoryListSkeleton } from "@/components/skeletons/inventory-list-skeleton";
import { useInventoryList } from "@/hooks/inventory/use-inventory-list";
import { usePagination } from "@/hooks/use-pagination";
import type { FilterDefinition } from "@/lib/types/filters";
import type {
  InventoryListItem,
  InventoryQueryParams,
} from "@/lib/types/inventory";
import { PaginationControls } from "../common/pagination-controls";
import { AdjustInventorySheet } from "./adjust-inventory-sheet";
import { EmptyInventoryState } from "./empty-inventory-state";
import { LowStockBadge } from "./low-stock-badge";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_SORT_BY = "updatedAt";
const DEFAULT_SORT_ORDER = "desc";

/**
 * Refactored Inventory List Client using universal components
 */
export function InventoryListClientRefactored() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [adjustSheetOpen, setAdjustSheetOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );

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

  const formatAttributes = (attributes?: Record<string, string>) => {
    if (!attributes || Object.keys(attributes).length === 0) {
      return "-";
    }
    return Object.entries(attributes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  };

  // Convert inventory items to table format
  const columns: Column<InventoryListItem>[] = [
    {
      id: "sku",
      header: "SKU",
      cell: (item) => <span className="font-mono text-xs">{item.sku}</span>,
    },
    {
      id: "title",
      header: "Product",
      cell: (item) => <span className="font-medium text-xs">{item.title}</span>,
    },
    {
      id: "attributes",
      header: "Attributes",
      cell: (item) => (
        <span className="text-xs text-muted-foreground">
          {formatAttributes(item.attributes)}
        </span>
      ),
    },
    {
      id: "inventory",
      header: "Inventory",
      cell: (item) => (
        <span className="text-right font-medium text-xs">{item.inventory}</span>
      ),
    },
    {
      id: "committed",
      header: "Reserved",
      cell: (item) => (
        <span className="text-right text-orange-600 text-xs">
          {item.committed}
        </span>
      ),
    },
    {
      id: "available",
      header: "Available",
      cell: (item) => (
        <span className="text-right text-green-600 font-medium text-xs">
          {item.available}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (item) => <LowStockBadge item={item} />,
    },
    {
      id: "updatedAt",
      header: "Updated",
      cell: (item) => (
        <span className="text-xs text-muted-foreground">
          {item.updatedAt
            ? formatDistanceToNow(new Date(item.updatedAt), {
                addSuffix: true,
              })
            : "-"}
        </span>
      ),
    },
  ];

  const rowActions: RowAction<InventoryListItem>[] = [
    {
      label: "Adjust Inventory",
      icon: <Edit className="h-4 w-4" />,
      onClick: (item) => {
        setSelectedVariantId(item.variantId);
        setAdjustSheetOpen(true);
      },
    },
    {
      label: "View Details",
      onClick: (item) => router.push(`/inventory/${item.variantId}`),
    },
  ];

  // Filter definitions for filter drawer
  const filterDefinitions: FilterDefinition[] = [
    {
      key: "status",
      label: "Product Status",
      type: "select",
      options: [
        { value: "all", label: "All Statuses" },
        { value: "draft", label: "Draft" },
        { value: "active", label: "Active" },
        { value: "archived", label: "Archived" },
      ],
    },
    {
      key: "lowStock",
      label: "Low Stock",
      type: "boolean",
    },
    {
      key: "outOfStock",
      label: "Out of Stock",
      type: "boolean",
    },
  ];

  const filterValues = {
    status: inventoryFilters.status,
    lowStock: inventoryFilters.lowStock,
    outOfStock: inventoryFilters.outOfStock,
  };

  const handleFiltersChange = (filters: Record<string, unknown>) => {
    setInventoryFilters((prev) => ({
      ...prev,
      status:
        filters.status === "all"
          ? undefined
          : (filters.status as InventoryQueryParams["status"]),
      lowStock: filters.lowStock as boolean | undefined,
      outOfStock: filters.outOfStock as boolean | undefined,
      page: DEFAULT_PAGE,
    }));
  };

  return (
    <>
      <ListLayout
        title="Inventory"
        description="Manage inventory levels across all product variants"
        searchPlaceholder="Search inventory..."
        searchValue={inventoryFilters.search || ""}
        onSearchChange={(value) =>
          setInventoryFilters((prev) => ({
            ...prev,
            search: value || undefined,
            page: DEFAULT_PAGE,
          }))
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
            itemLabel="inventory items"
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
          <DataTable
            columns={columns}
            data={inventoryData?.data || []}
            rowActions={rowActions}
            onRowClick={(item) => router.push(`/inventory/${item.variantId}`)}
            emptyMessage="No inventory items found"
            isLoading={isLoading}
          />
        </QueryState>
      </ListLayout>

      {selectedVariantId && (
        <AdjustInventorySheet
          variantId={selectedVariantId}
          open={adjustSheetOpen}
          onOpenChange={(open) => {
            setAdjustSheetOpen(open);
            if (!open) {
              setSelectedVariantId(null);
            }
          }}
        />
      )}
    </>
  );
}

/**
 * Parses search parameters from URL into InventoryQueryParams
 */
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

/**
 * Hook to sync inventory filters to URL when they change
 */
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
