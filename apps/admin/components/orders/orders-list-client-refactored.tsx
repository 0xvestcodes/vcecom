"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { OrdersTableSkeleton } from "@/components/skeletons/orders-table-skeleton";
import { useAdminOrders } from "@/hooks/orders/use-admin-orders";
import { usePagination } from "@/hooks/use-pagination";
import {
  ORDER_DEFAULT_LIMIT,
  ORDER_DEFAULT_PAGE,
} from "@/lib/constants/orders.constants";
import type { FilterDefinition } from "@/lib/types/filters";
import type {
  FulfillmentStatus,
  Order,
  OrderQueryParams,
  OrderStatus,
  PaymentStatus,
} from "@/lib/types/orders";
import { formatCurrency } from "@/lib/utils";
import { PaginationControls } from "../common/pagination-controls";
import { DateTime } from "./date-time";
import { EmptyOrdersState } from "./empty-orders-state";
import { FulfillmentStatusBadge } from "./fulfillment-status-badge";
import { Money } from "./money";
import { OrderStatusBadge } from "./order-status-badge";
import { PaymentStatusBadge } from "./payment-status-badge";

/**
 * Refactored Orders List Client using universal components
 */
export function OrdersListClientRefactored() {
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

  const pagination = usePagination(ordersData, handlePageChange);

  const handleClearFilters = useCallback(() => {
    setOrderFilters({
      page: ORDER_DEFAULT_PAGE,
      limit: ORDER_DEFAULT_LIMIT,
    });
  }, []);

  // Convert orders to table format
  const columns: Column<Order>[] = [
    {
      id: "orderNumber",
      header: "Order ID",
      cell: (order) => <span className="font-medium">{order.orderNumber}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      id: "customer",
      header: "Customer",
      cell: (order) => (
        <div className="flex flex-col">
          <span className="text-xs">
            {order.customerName || order.customerEmail || "Guest Checkout"}
          </span>
          {order.customerEmail && order.customerName && (
            <span className="text-[10px] text-muted-foreground">
              {order.customerEmail}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "total",
      header: "Total",
      cell: (order) => <Money amount={order.total} />,
    },
    {
      id: "paymentMethod",
      header: "Payment",
      cell: (order) => (
        <div className="flex flex-col">
          <span className="text-xs font-medium">
            {order.paymentMethod || "N/A"}
          </span>
        </div>
      ),
    },
    {
      id: "paymentStatus",
      header: "Payment Status",
      cell: (order) =>
        order.paymentStatus ? (
          <PaymentStatusBadge status={order.paymentStatus} />
        ) : (
          <span className="text-xs text-muted-foreground">N/A</span>
        ),
    },
    {
      id: "fulfillmentStatus",
      header: "Fulfillment",
      cell: (order) =>
        order.fulfillmentStatus ? (
          <FulfillmentStatusBadge status={order.fulfillmentStatus} />
        ) : (
          <span className="text-xs text-muted-foreground">N/A</span>
        ),
    },
    {
      id: "createdAt",
      header: "Created",
      cell: (order) => <DateTime date={order.createdAt} />,
    },
  ];

  const rowActions: RowAction<Order>[] = [
    {
      label: "View Order",
      onClick: (order) => router.push(`/orders/${order.id}`),
    },
  ];

  // Filter definitions for filter drawer
  const filterDefinitions: FilterDefinition[] = [
    {
      key: "status",
      label: "Order Status",
      type: "select",
      options: [
        { value: "all", label: "All Statuses" },
        { value: "pending", label: "Pending" },
        { value: "confirmed", label: "Confirmed" },
        { value: "processing", label: "Processing" },
        { value: "shipped", label: "Shipped" },
        { value: "delivered", label: "Delivered" },
        { value: "cancelled", label: "Cancelled" },
        { value: "refunded", label: "Refunded" },
      ],
    },
    {
      key: "paymentStatus",
      label: "Payment Status",
      type: "select",
      options: [
        { value: "all", label: "All Statuses" },
        { value: "pending", label: "Pending" },
        { value: "initiated", label: "Initiated" },
        { value: "completed", label: "Completed" },
        { value: "failed", label: "Failed" },
        { value: "refunded", label: "Refunded" },
      ],
    },
    {
      key: "fulfillmentStatus",
      label: "Fulfillment Status",
      type: "select",
      options: [
        { value: "all", label: "All Statuses" },
        { value: "unfulfilled", label: "Unfulfilled" },
        { value: "partially_fulfilled", label: "Partially Fulfilled" },
        { value: "fulfilled", label: "Fulfilled" },
        { value: "shipped", label: "Shipped" },
        { value: "delivered", label: "Delivered" },
      ],
    },
    {
      key: "paymentMethod",
      label: "Payment Method",
      type: "select",
      options: [
        { value: "all", label: "All Methods" },
        { value: "COD", label: "Cash on Delivery" },
        { value: "prepaid", label: "Prepaid" },
      ],
    },
    {
      key: "dateRange",
      label: "Date Range",
      type: "dateRange",
    },
    {
      key: "price",
      label: "Order Value Range",
      type: "range",
    },
  ];

  const filterValues = {
    status: orderFilters.status,
    paymentStatus: orderFilters.paymentStatus,
    fulfillmentStatus: orderFilters.fulfillmentStatus,
    paymentMethod: orderFilters.paymentMethod,
    dateRange: {
      from: orderFilters.startDate,
      to: orderFilters.endDate,
    },
    price: {
      min: orderFilters.minValue,
      max: orderFilters.maxValue,
    },
  };

  const handleFiltersChange = (filters: Record<string, unknown>) => {
    setOrderFilters((prev) => ({
      ...prev,
      status:
        filters.status === "all" ? undefined : (filters.status as OrderStatus),
      paymentStatus:
        filters.paymentStatus === "all"
          ? undefined
          : (filters.paymentStatus as PaymentStatus),
      fulfillmentStatus:
        filters.fulfillmentStatus === "all"
          ? undefined
          : (filters.fulfillmentStatus as FulfillmentStatus),
      paymentMethod:
        filters.paymentMethod === "all"
          ? undefined
          : (filters.paymentMethod as "COD" | "prepaid"),
      startDate: (filters.dateRange as { from?: string; to?: string })?.from,
      endDate: (filters.dateRange as { from?: string; to?: string })?.to,
      minValue: (filters.price as { min?: number; max?: number })?.min,
      maxValue: (filters.price as { min?: number; max?: number })?.max,
      page: ORDER_DEFAULT_PAGE,
    }));
  };

  return (
    <ListLayout
      title="Orders"
      description="Manage and track all orders"
      searchPlaceholder="Search orders..."
      searchValue={orderFilters.search || ""}
      onSearchChange={(value) =>
        setOrderFilters((prev) => ({
          ...prev,
          search: value || undefined,
          page: ORDER_DEFAULT_PAGE,
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
          itemLabel="orders"
        />
      }
    >
      <QueryState
        isLoading={isLoading}
        error={error}
        data={ordersData}
        loadingComponent={<OrdersTableSkeleton />}
        emptyComponent={<EmptyOrdersState />}
        onRetry={() => window.location.reload()}
      >
        <DataTable
          columns={columns}
          data={ordersData?.data || []}
          rowActions={rowActions}
          onRowClick={(order) => router.push(`/orders/${order.id}`)}
          emptyMessage="No orders found"
          isLoading={isLoading}
        />
      </QueryState>
    </ListLayout>
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
  };
}

/**
 * Hook to sync order filters to URL when they change
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

    router.replace(`/orders?${urlParams.toString()}`, { scroll: false });
  }, [filters, router]);
}
