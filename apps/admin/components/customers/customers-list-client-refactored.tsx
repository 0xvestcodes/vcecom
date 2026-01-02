"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type Column, DataTable } from "@/components/common/data-table";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { useAdminCustomers } from "@/hooks/customers/use-admin-customers";
import { usePagination } from "@/hooks/use-pagination";
import {
  CUSTOMER_DEFAULT_LIMIT,
  CUSTOMER_DEFAULT_PAGE,
} from "@/lib/constants/customers.constants";
import type { Customer, CustomerQueryParams } from "@/lib/types/customers";
import { PaginationControls } from "../common/pagination-controls";
import { CustomersTableSkeleton } from "./customers-table-skeleton";
import { EmptyCustomersState } from "./empty-customers-state";

/**
 * Refactored Customers List Client using universal components
 */
export function CustomersListClientRefactored() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [customerFilters, setCustomerFilters] =
    useState<CustomerQueryParams>(initialFilters);

  const {
    data: customersData,
    isLoading,
    error,
    refetch,
  } = useAdminCustomers(customerFilters);

  useSyncFiltersToUrl(customerFilters, router);

  const handlePageChange = useCallback((newPage: number) => {
    setCustomerFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const paginationData = customersData
    ? {
        page: customersData.page,
        limit: customersData.limit,
        total: customersData.total,
        totalPages: customersData.totalPages,
        hasNextPage: customersData.page < customersData.totalPages,
        hasPreviousPage: customersData.page > 1,
      }
    : undefined;
  const pagination = usePagination(paginationData, handlePageChange);

  const handleClearFilters = useCallback(() => {
    setCustomerFilters({
      page: CUSTOMER_DEFAULT_PAGE,
      limit: CUSTOMER_DEFAULT_LIMIT,
    });
  }, []);

  // Convert customers to table format
  const columns: Column<Customer>[] = [
    {
      id: "name",
      header: "Name",
      cell: (customer) => (
        <div>
          <div className="font-medium">{customer.name || "N/A"}</div>
          {customer.email && (
            <div className="text-xs text-muted-foreground">
              {customer.email}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "phone",
      header: "Phone",
      cell: (customer) => customer.phone || "-",
    },
    {
      id: "totalOrders",
      header: "Orders",
      cell: (customer) => customer.totalOrders || 0,
    },
    {
      id: "totalSpent",
      header: "Total Spent",
      cell: (customer) =>
        customer.totalSpent
          ? new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
            }).format(customer.totalSpent / 100)
          : "-",
    },
  ];

  return (
    <ListLayout
      title="Customers"
      description="Manage your customers"
      searchPlaceholder="Search customers..."
      searchValue={customerFilters.search || ""}
      onSearchChange={(value) =>
        setCustomerFilters((prev) => ({
          ...prev,
          search: value || undefined,
          page: CUSTOMER_DEFAULT_PAGE,
        }))
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
          itemLabel="customers"
        />
      }
    >
      <QueryState
        isLoading={isLoading}
        error={error}
        data={customersData}
        loadingComponent={<CustomersTableSkeleton />}
        emptyComponent={
          <EmptyCustomersState hasSearchFilter={!!customerFilters.search} />
        }
        onRetry={() => refetch()}
      >
        <DataTable<Customer>
          columns={columns}
          data={customersData?.data || []}
          onRowClick={(_customer) => {
            // TODO: Navigate to customer detail if exists
            // router.push(`/customers/${customer.id}`);
          }}
          emptyMessage="No customers found"
          isLoading={isLoading}
        />
      </QueryState>
    </ListLayout>
  );
}

/**
 * Parses search parameters from URL into CustomerQueryParams
 */
function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): CustomerQueryParams {
  return {
    page: parseInt(
      searchParams.get("page") || String(CUSTOMER_DEFAULT_PAGE),
      10,
    ),
    limit: parseInt(
      searchParams.get("limit") || String(CUSTOMER_DEFAULT_LIMIT),
      10,
    ),
    search: searchParams.get("search") || undefined,
  };
}

/**
 * Hook to sync customer filters to URL when they change
 */
function useSyncFiltersToUrl(
  filters: CustomerQueryParams,
  router: ReturnType<typeof useRouter>,
) {
  useEffect(() => {
    const urlParams = new URLSearchParams();

    if (filters.page && filters.page > CUSTOMER_DEFAULT_PAGE) {
      urlParams.set("page", filters.page.toString());
    }
    if (filters.limit && filters.limit !== CUSTOMER_DEFAULT_LIMIT) {
      urlParams.set("limit", filters.limit.toString());
    }
    if (filters.search) urlParams.set("search", filters.search);

    router.replace(`/customers?${urlParams.toString()}`, { scroll: false });
  }, [filters, router]);
}
