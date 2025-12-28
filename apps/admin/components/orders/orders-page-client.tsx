"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { QueryState } from "@/components/common/query-state";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { OrdersTableSkeleton } from "@/components/skeletons/orders-table-skeleton";
import { useAdminOrders } from "@/hooks/orders/use-admin-orders";
import type { PaginationData } from "@/hooks/use-pagination";
import {
  ORDER_DEFAULT_LIMIT,
  ORDER_DEFAULT_PAGE,
} from "@/lib/constants/orders.constants";
import type {
  FulfillmentStatus,
  OrderQueryParams,
  OrderSortBy,
  OrderSortOrder,
  OrderStatus,
  PaymentStatus,
} from "@/lib/types/orders";
import { PaginationControls } from "../common/pagination-controls";
import { OrderFiltersBar } from "./order-filters-bar";
import { OrdersTable } from "./orders-table";

/**
 * Client component for orders page
 * Handles all client-side logic including state management and interactions
 */
export function OrdersPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [orderFilters, setOrderFilters] =
    useState<OrderQueryParams>(initialFilters);

  const { data: ordersData, isLoading, error } = useAdminOrders(orderFilters);

  useSyncFiltersToUrl(orderFilters, router);

  const handlePageChange = useCallback((newPage: number) => {
    setOrderFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const paginationData: PaginationData | undefined = ordersData
    ? {
        page: ordersData.page,
        limit: ordersData.limit,
        total: ordersData.total,
        totalPages: ordersData.totalPages,
        hasNextPage: ordersData.page < ordersData.totalPages,
        hasPreviousPage: ordersData.page > 1,
      }
    : undefined;

  const handlePreviousPage = useCallback(() => {
    if (paginationData?.hasPreviousPage) {
      handlePageChange(paginationData.page - 1);
    }
  }, [paginationData, handlePageChange]);

  const handleNextPage = useCallback(() => {
    if (paginationData?.hasNextPage) {
      handlePageChange(paginationData.page + 1);
    }
  }, [paginationData, handlePageChange]);

  const paginationInfo = paginationData
    ? {
        startItem: (paginationData.page - 1) * paginationData.limit + 1,
        endItem: Math.min(
          paginationData.page * paginationData.limit,
          paginationData.total,
        ),
        total: paginationData.total,
        currentPage: paginationData.page,
        totalPages: paginationData.totalPages,
      }
    : null;

  const handleStatusChange = useCallback((status: OrderStatus | undefined) => {
    setOrderFilters((prev) => ({ ...prev, status, page: ORDER_DEFAULT_PAGE }));
  }, []);

  const handlePaymentStatusChange = useCallback(
    (status: PaymentStatus | undefined) => {
      setOrderFilters((prev) => ({
        ...prev,
        paymentStatus: status,
        page: ORDER_DEFAULT_PAGE,
      }));
    },
    [],
  );

  const handleFulfillmentStatusChange = useCallback(
    (status: FulfillmentStatus | undefined) => {
      setOrderFilters((prev) => ({
        ...prev,
        fulfillmentStatus: status,
        page: ORDER_DEFAULT_PAGE,
      }));
    },
    [],
  );

  const handleSearchChange = useCallback((search: string) => {
    setOrderFilters((prev) => ({
      ...prev,
      search: search || undefined,
      page: ORDER_DEFAULT_PAGE,
    }));
  }, []);

  const handleDateRangeChange = useCallback(
    (range: { from?: Date; to?: Date } | undefined) => {
      setOrderFilters((prev) => ({
        ...prev,
        startDate: range?.from?.toISOString(),
        endDate: range?.to?.toISOString(),
        page: ORDER_DEFAULT_PAGE,
      }));
    },
    [],
  );

  const handlePriceRangeChange = useCallback((min?: number, max?: number) => {
    setOrderFilters((prev) => ({
      ...prev,
      minValue: min,
      maxValue: max,
      page: ORDER_DEFAULT_PAGE,
    }));
  }, []);

  const handlePaymentMethodChange = useCallback(
    (method: "COD" | "prepaid" | "all") => {
      setOrderFilters((prev) => ({
        ...prev,
        paymentMethod: method === "all" ? undefined : method,
        page: ORDER_DEFAULT_PAGE,
      }));
    },
    [],
  );

  const _handleSortChange = useCallback(
    (sortBy: OrderSortBy, sortOrder: OrderSortOrder) => {
      setOrderFilters((prev) => ({
        ...prev,
        sortBy,
        sortOrder,
        page: ORDER_DEFAULT_PAGE,
      }));
    },
    [],
  );

  const handleClearFilters = useCallback(() => {
    setOrderFilters({
      page: ORDER_DEFAULT_PAGE,
      limit: ORDER_DEFAULT_LIMIT,
    });
  }, []);

  const dateRange = convertDateStringsToDateRange(
    orderFilters.startDate,
    orderFilters.endDate,
  );

  return (
    <AdminPageLayout
      title="Orders"
      description="Manage and track all orders"
      filters={
        <OrderFiltersBar
          status={orderFilters.status}
          paymentStatus={orderFilters.paymentStatus}
          fulfillmentStatus={orderFilters.fulfillmentStatus}
          search={orderFilters.search}
          dateRange={dateRange}
          minValue={orderFilters.minValue}
          maxValue={orderFilters.maxValue}
          paymentMethod={
            orderFilters.paymentMethod || ("all" as "COD" | "prepaid" | "all")
          }
          // Note: Sort functionality temporarily disabled as backend doesn't support it yet
          // sortBy={orderFilters.sortBy || "createdAt"}
          // sortOrder={orderFilters.sortOrder || "desc"}
          onStatusChange={handleStatusChange}
          onPaymentStatusChange={handlePaymentStatusChange}
          onFulfillmentStatusChange={handleFulfillmentStatusChange}
          onSearchChange={handleSearchChange}
          onDateRangeChange={handleDateRangeChange}
          onPriceRangeChange={handlePriceRangeChange}
          onPaymentMethodChange={handlePaymentMethodChange}
          // onSortChange={handleSortChange}
          onClear={handleClearFilters}
        />
      }
      pagination={
        <PaginationControls
          paginationInfo={paginationInfo}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          canGoPrevious={paginationData?.hasPreviousPage ?? false}
          canGoNext={paginationData?.hasNextPage ?? false}
          isLoading={isLoading}
          itemLabel="orders"
        />
      }
    >
      <QueryState
        isLoading={isLoading}
        error={error}
        data={ordersData}
        loadingComponent={<OrdersTableSkeleton />}
        onRetry={() => window.location.reload()}
      >
        <OrdersTable orders={ordersData?.data || []} />
      </QueryState>
    </AdminPageLayout>
  );
}

/**
 * Parses search parameters from URL into OrderQueryParams
 */
function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): OrderQueryParams {
  return {
    page: parseInt(searchParams.get("page") || String(ORDER_DEFAULT_PAGE), 10),
    limit: parseInt(
      searchParams.get("limit") || String(ORDER_DEFAULT_LIMIT),
      10,
    ),
    status: (searchParams.get("status") as OrderStatus) || undefined,
    paymentStatus:
      (searchParams.get("paymentStatus") as PaymentStatus) || undefined,
    fulfillmentStatus:
      (searchParams.get("fulfillmentStatus") as FulfillmentStatus) || undefined,
    search: searchParams.get("search") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    minValue: (() => {
      const minValue = searchParams.get("minValue");
      return minValue ? parseFloat(minValue) : undefined;
    })(),
    maxValue: (() => {
      const maxValue = searchParams.get("maxValue");
      return maxValue ? parseFloat(maxValue) : undefined;
    })(),
    paymentMethod:
      (searchParams.get("paymentMethod") as "COD" | "prepaid") || undefined,
    // Note: sortBy and sortOrder are removed as backend doesn't support them yet
    // sortBy: (searchParams.get("sortBy") as OrderSortBy) || undefined,
    // sortOrder: (searchParams.get("sortOrder") as OrderSortOrder) || undefined,
  };
}

/**
 * Hook to sync order filters to URL when they change
 * Updates URL parameters based on filter state
 */
function useSyncFiltersToUrl(
  filters: OrderQueryParams,
  router: ReturnType<typeof useRouter>,
) {
  useEffect(() => {
    const urlParams = new URLSearchParams();

    if (filters.page && filters.page > ORDER_DEFAULT_PAGE) {
      urlParams.set("page", filters.page.toString());
    }
    if (filters.limit && filters.limit !== ORDER_DEFAULT_LIMIT) {
      urlParams.set("limit", filters.limit.toString());
    }
    if (filters.status) urlParams.set("status", filters.status);
    if (filters.paymentStatus)
      urlParams.set("paymentStatus", filters.paymentStatus);
    if (filters.fulfillmentStatus)
      urlParams.set("fulfillmentStatus", filters.fulfillmentStatus);
    if (filters.search) urlParams.set("search", filters.search);
    if (filters.startDate) urlParams.set("startDate", filters.startDate);
    if (filters.endDate) urlParams.set("endDate", filters.endDate);
    if (filters.minValue !== undefined)
      urlParams.set("minValue", filters.minValue.toString());
    if (filters.maxValue !== undefined)
      urlParams.set("maxValue", filters.maxValue.toString());
    if (filters.paymentMethod)
      urlParams.set("paymentMethod", filters.paymentMethod);
    // Note: sortBy and sortOrder are removed as backend doesn't support them yet
    // if (filters.sortBy) urlParams.set("sortBy", filters.sortBy);
    // if (filters.sortOrder) urlParams.set("sortOrder", filters.sortOrder);

    router.replace(`/orders?${urlParams.toString()}`, { scroll: false });
  }, [filters, router]);
}

/**
 * Converts date strings to Date objects for date range picker
 */
function convertDateStringsToDateRange(
  startDate?: string,
  endDate?: string,
): { from: Date; to: Date } | undefined {
  if (startDate && endDate) {
    return {
      from: new Date(startDate),
      to: new Date(endDate),
    };
  }
  return undefined;
}
