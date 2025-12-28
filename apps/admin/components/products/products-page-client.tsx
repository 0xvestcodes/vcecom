"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProtectedButton } from "@/components/common/protected-button";
import { QueryState } from "@/components/common/query-state";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { ProductsTableSkeleton } from "@/components/skeletons/products-table-skeleton";
import { Button } from "@/components/ui/button";
import { useAdminDeleteProduct } from "@/hooks/products/use-admin-delete-product";
import { useAdminProducts } from "@/hooks/products/use-admin-products";
import { usePagination } from "@/hooks/use-pagination";
import {
  PRODUCT_DEFAULT_LIMIT,
  PRODUCT_DEFAULT_PAGE,
  PRODUCT_DEFAULT_SORT_BY,
  PRODUCT_DEFAULT_SORT_ORDER,
  PRODUCT_DELETE_CONFIRMATION_MESSAGE,
} from "@/lib/constants/products.constants";
import type { ProductQueryParams } from "@/lib/types/products";
import { PaginationControls } from "../common/pagination-controls";
import { EmptyProductsState } from "./empty-products-state";
import { ProductFiltersBar } from "./product-filters-bar";
import { ProductsTable } from "./products-table";

/**
 * Client component for products page
 * Handles all client-side logic including state management and interactions
 */
export function ProductsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deleteProductMutation = useAdminDeleteProduct();

  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [productFilters, setProductFilters] =
    useState<ProductQueryParams>(initialFilters);

  const {
    data: productsData,
    isLoading,
    error,
  } = useAdminProducts(productFilters);

  useSyncFiltersToUrl(productFilters, router);

  const handlePageChange = useCallback((newPage: number) => {
    setProductFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const pagination = usePagination(productsData, handlePageChange);

  const handleDeleteProduct = useCallback(
    async (productId: string) => {
      if (confirm(PRODUCT_DELETE_CONFIRMATION_MESSAGE)) {
        await deleteProductMutation.mutateAsync(productId);
      }
    },
    [deleteProductMutation],
  );

  const handleClearFilters = useCallback(() => {
    setProductFilters({
      page: PRODUCT_DEFAULT_PAGE,
      limit: PRODUCT_DEFAULT_LIMIT,
      sortBy: PRODUCT_DEFAULT_SORT_BY,
      sortOrder: PRODUCT_DEFAULT_SORT_ORDER,
    });
  }, []);

  return (
    <AdminPageLayout
      title="Products"
      description="Manage your product catalog"
      actions={
        <ProtectedButton requiredRoles={["admin", "marketing"]}>
          <Button asChild>
            <Link href="/products/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Product
            </Link>
          </Button>
        </ProtectedButton>
      }
      filters={
        <ProductFiltersBar
          filters={productFilters}
          onFiltersChange={setProductFilters}
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
          itemLabel="products"
        />
      }
    >
      <QueryState
        isLoading={isLoading}
        error={error}
        data={productsData}
        loadingComponent={<ProductsTableSkeleton />}
        emptyComponent={<EmptyProductsState />}
        onRetry={() => window.location.reload()}
      >
        <ProductsTable
          products={productsData?.data || []}
          onDeleteProduct={handleDeleteProduct}
        />
      </QueryState>
    </AdminPageLayout>
  );
}

/**
 * Parses search parameters from URL into ProductQueryParams
 */
function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): ProductQueryParams {
  return {
    page: parseInt(
      searchParams.get("page") || String(PRODUCT_DEFAULT_PAGE),
      10,
    ),
    limit: parseInt(
      searchParams.get("limit") || String(PRODUCT_DEFAULT_LIMIT),
      10,
    ),
    status:
      (searchParams.get("status") as ProductQueryParams["status"]) || undefined,
    search: searchParams.get("search") || undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    minPrice: (() => {
      const minPriceParam = searchParams.get("minPrice");
      return minPriceParam ? parseFloat(minPriceParam) : undefined;
    })(),
    maxPrice: (() => {
      const maxPriceParam = searchParams.get("maxPrice");
      return maxPriceParam ? parseFloat(maxPriceParam) : undefined;
    })(),
    inStock:
      searchParams.get("inStock") === "true"
        ? true
        : searchParams.get("inStock") === "false"
          ? false
          : undefined,
    sortBy:
      (searchParams.get("sortBy") as ProductQueryParams["sortBy"]) ||
      PRODUCT_DEFAULT_SORT_BY,
    sortOrder:
      (searchParams.get("sortOrder") as "asc" | "desc") ||
      PRODUCT_DEFAULT_SORT_ORDER,
  };
}

/**
 * Hook to sync product filters to URL when they change
 * Updates URL parameters based on filter state
 */
function useSyncFiltersToUrl(
  filters: ProductQueryParams,
  router: ReturnType<typeof useRouter>,
) {
  useEffect(() => {
    const urlParams = new URLSearchParams();

    if (filters.page && filters.page > PRODUCT_DEFAULT_PAGE) {
      urlParams.set("page", filters.page.toString());
    }
    if (filters.limit && filters.limit !== PRODUCT_DEFAULT_LIMIT) {
      urlParams.set("limit", filters.limit.toString());
    }
    if (filters.status) urlParams.set("status", filters.status);
    if (filters.search) urlParams.set("search", filters.search);
    if (filters.categoryId) urlParams.set("categoryId", filters.categoryId);
    if (filters.minPrice !== undefined) {
      urlParams.set("minPrice", filters.minPrice.toString());
    }
    if (filters.maxPrice !== undefined) {
      urlParams.set("maxPrice", filters.maxPrice.toString());
    }
    if (filters.inStock !== undefined) {
      urlParams.set("inStock", filters.inStock.toString());
    }
    if (filters.sortBy) urlParams.set("sortBy", filters.sortBy);
    if (filters.sortOrder) urlParams.set("sortOrder", filters.sortOrder);

    router.replace(`/products?${urlParams.toString()}`, { scroll: false });
  }, [filters, router]);
}
