"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Tag, Trash2 } from "lucide-react";
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
import { useAdminDiscounts } from "@/hooks/discounts/use-admin-discounts";
import { usePagination } from "@/hooks/use-pagination";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { Discount, DiscountQueryParams } from "@/lib/types/discounts";
import { PaginationControls } from "../common/pagination-controls";
import { DateTime } from "../orders/date-time";
import { Money } from "../orders/money";
import { DiscountSheet } from "./discount-sheet";
import { EmptyDiscountsState } from "./empty-discounts-state";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/**
 * Refactored Discounts List Client using universal components
 */
export function DiscountsListClientRefactored() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [discountSheetOpen, setDiscountSheetOpen] = useState(false);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [discountFilters, setDiscountFilters] =
    useState<DiscountQueryParams>(initialFilters);

  const {
    data: discountsData,
    isLoading,
    error,
    refetch,
  } = useAdminDiscounts(discountFilters);

  useSyncFiltersToUrl(discountFilters, router);

  const handlePageChange = useCallback((newPage: number) => {
    setDiscountFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const paginationData = discountsData
    ? {
        page: discountsData.page,
        limit: discountsData.limit,
        total: discountsData.total,
        totalPages: discountsData.totalPages,
        hasNextPage: discountsData.page < discountsData.totalPages,
        hasPreviousPage: discountsData.page > 1,
      }
    : undefined;

  const pagination = usePagination(paginationData, handlePageChange);

  const handleCreate = () => {
    setSelectedDiscountId(null);
    setDiscountSheetOpen(true);
  };

  const handleEdit = (discountId: string) => {
    setSelectedDiscountId(discountId);
    setDiscountSheetOpen(true);
  };

  const handleDeleteClick = (discountId: string) => {
    setDiscountToDelete(discountId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!discountToDelete) return;

    setIsDeleting(true);
    try {
      await api.delete<void>(endpoints.discounts.delete(discountToDelete));
      queryClient.invalidateQueries({ queryKey: [endpoints.discounts.list] });
      toast.success("Discount deleted successfully");
      setDeleteDialogOpen(false);
      setDiscountToDelete(null);
    } catch (_error) {
      toast.error("Failed to delete discount");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearFilters = useCallback(() => {
    setDiscountFilters({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
    });
  }, []);

  // Convert discounts to table format
  const columns: Column<Discount>[] = [
    {
      id: "code",
      header: "Code",
      cell: (discount) => <span className="font-medium">{discount.code}</span>,
    },
    {
      id: "type",
      header: "Type",
      cell: (discount) => (
        <Badge variant="outline" className="text-xs">
          {discount.type}
        </Badge>
      ),
    },
    {
      id: "value",
      header: "Value",
      cell: (discount) =>
        discount.valueType === "PERCENTAGE" ? (
          `${discount.value}%`
        ) : (
          <Money amount={discount.value} />
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (discount) => (
        <Badge
          variant={discount.isActive ? "default" : "secondary"}
          className="text-xs"
        >
          {discount.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "usage",
      header: "Used",
      cell: (discount) =>
        discount.usageLimit
          ? `${discount.usageCount}/${discount.usageLimit}`
          : discount.usageCount,
    },
    {
      id: "createdAt",
      header: "Created",
      cell: (discount) => <DateTime date={discount.createdAt} />,
    },
  ];

  const rowActions: RowAction<Discount>[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (discount) => handleEdit(discount.id),
      roles: ["admin", "marketing"],
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (discount) => handleDeleteClick(discount.id),
      destructive: true,
      roles: ["admin", "marketing"],
    },
  ];

  return (
    <>
      <ListLayout
        title="Discounts"
        description="Manage discount codes"
        createButton={
          <ProtectedButton requiredRoles={["admin", "marketing"]}>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Discount
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
            itemLabel="discounts"
          />
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={discountsData}
          loadingComponent={
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          }
          emptyComponent={<EmptyDiscountsState />}
          onRetry={() => refetch()}
        >
          <DataTable
            columns={columns}
            data={discountsData?.data || []}
            rowActions={rowActions}
            emptyMessage="No discounts found"
            isLoading={isLoading}
          />
        </QueryState>
      </ListLayout>

      <DiscountSheet
        discountId={selectedDiscountId}
        open={discountSheetOpen}
        onOpenChange={(open) => {
          setDiscountSheetOpen(open);
          if (!open) {
            setSelectedDiscountId(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Discount"
        description="Are you sure you want to delete this discount? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />
    </>
  );
}

/**
 * Parses search parameters from URL into DiscountQueryParams
 */
function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): DiscountQueryParams {
  return {
    page: parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10),
    limit: parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    isActive:
      searchParams.get("isActive") === "true"
        ? true
        : searchParams.get("isActive") === "false"
          ? false
          : undefined,
    type:
      (searchParams.get("type") as DiscountQueryParams["type"]) || undefined,
    applicationType:
      (searchParams.get(
        "applicationType",
      ) as DiscountQueryParams["applicationType"]) || undefined,
    search: searchParams.get("search") || undefined,
  };
}

/**
 * Hook to sync discount filters to URL when they change
 */
function useSyncFiltersToUrl(
  filters: DiscountQueryParams,
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
    if (filters.isActive !== undefined) {
      urlParams.set("isActive", filters.isActive.toString());
    }
    if (filters.type) urlParams.set("type", filters.type);
    if (filters.applicationType)
      urlParams.set("applicationType", filters.applicationType);
    if (filters.search) urlParams.set("search", filters.search);

    router.replace(`/discounts?${urlParams.toString()}`, { scroll: false });
  }, [filters, router]);
}
