"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
} from "@/lib/types/orders";
import { DateRangePicker } from "./date-range-picker";

interface OrderFiltersBarProps {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  search?: string;
  dateRange?: { from?: Date; to?: Date };
  minValue?: number;
  maxValue?: number;
  paymentMethod?: "COD" | "prepaid" | "all";
  // Note: Sort functionality temporarily disabled as backend doesn't support it yet
  // sortBy?: OrderSortBy;
  // sortOrder?: OrderSortOrder;
  onStatusChange: (status: OrderStatus | undefined) => void;
  onPaymentStatusChange: (status: PaymentStatus | undefined) => void;
  onFulfillmentStatusChange: (status: FulfillmentStatus | undefined) => void;
  onSearchChange: (search: string) => void;
  onDateRangeChange: (range: { from?: Date; to?: Date } | undefined) => void;
  onPriceRangeChange: (min?: number, max?: number) => void;
  onPaymentMethodChange: (method: "COD" | "prepaid" | "all") => void;
  // onSortChange: (sortBy: OrderSortBy, sortOrder: OrderSortOrder) => void;
  onClear: () => void;
}

export function OrderFiltersBar({
  status,
  paymentStatus,
  fulfillmentStatus,
  search,
  dateRange,
  minValue,
  maxValue,
  paymentMethod = "all",
  // Note: Sort functionality temporarily disabled as backend doesn't support it yet
  // sortBy = "createdAt",
  // sortOrder = "desc",
  onStatusChange,
  onPaymentStatusChange,
  onFulfillmentStatusChange,
  onSearchChange,
  onDateRangeChange,
  onPriceRangeChange,
  onPaymentMethodChange,
  // onSortChange,
  onClear,
}: OrderFiltersBarProps) {
  const [searchValue, setSearchValue] = useState(search || "");
  const [minPrice, setMinPrice] = useState(minValue?.toString() || "");
  const [maxPrice, setMaxPrice] = useState(maxValue?.toString() || "");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, onSearchChange]);

  // Debounce price range
  useEffect(() => {
    const timer = setTimeout(() => {
      const min = minPrice ? parseFloat(minPrice) : undefined;
      const max = maxPrice ? parseFloat(maxPrice) : undefined;
      if (min !== undefined || max !== undefined) {
        onPriceRangeChange(min, max);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [minPrice, maxPrice, onPriceRangeChange]);

  const hasFilters =
    status ||
    paymentStatus ||
    fulfillmentStatus ||
    searchValue ||
    dateRange?.from ||
    dateRange?.to ||
    minPrice ||
    maxPrice ||
    paymentMethod !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order ID, customer email..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={status || "all"}
          onValueChange={(value) =>
            onStatusChange(value === "all" ? undefined : (value as OrderStatus))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={paymentStatus || "all"}
          onValueChange={(value) =>
            onPaymentStatusChange(
              value === "all" ? undefined : (value as PaymentStatus),
            )
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Payment Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="initiated">Initiated</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={fulfillmentStatus || "all"}
          onValueChange={(value) =>
            onFulfillmentStatusChange(
              value === "all" ? undefined : (value as FulfillmentStatus),
            )
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Fulfillment Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fulfillment Statuses</SelectItem>
            <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
            <SelectItem value="partially_fulfilled">
              Partially Fulfilled
            </SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={paymentMethod}
          onValueChange={(value) =>
            onPaymentMethodChange(value as "COD" | "prepaid" | "all")
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Payment Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="COD">COD</SelectItem>
            <SelectItem value="prepaid">Prepaid</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
        />

        {/* Note: Sort functionality temporarily disabled as backend doesn't support it yet */}
        {/* <Select
          value={`${sortBy}-${sortOrder}`}
          onValueChange={(value) => {
            const [by, order] = value.split("-") as [
              OrderSortBy,
              OrderSortOrder,
            ];
            onSortChange(by, order);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt-desc">Newest First</SelectItem>
            <SelectItem value="createdAt-asc">Oldest First</SelectItem>
            <SelectItem value="total-desc">Highest Value</SelectItem>
            <SelectItem value="total-asc">Lowest Value</SelectItem>
            <SelectItem value="orderNumber-asc">Order # (A-Z)</SelectItem>
            <SelectItem value="orderNumber-desc">Order # (Z-A)</SelectItem>
          </SelectContent>
        </Select> */}

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="min-price" className="text-sm text-muted-foreground">
            Price Range:
          </Label>
          <Input
            id="min-price"
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-[100px]"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            id="max-price"
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-[100px]"
          />
        </div>
      </div>
    </div>
  );
}
