"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { OrdersTableSkeleton } from "@/components/skeletons/orders-table-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAbandonedCheckouts } from "@/hooks/abandoned-checkouts/use-abandoned-checkouts";
import { useAdminPaymentReconcile } from "@/hooks/orders/use-admin-payment-reconcile";
import type { AbandonedCheckout } from "@/lib/types/abandoned-checkouts";
import { AbandonedCartAnalytics } from "./abandoned-cart-analytics";
import { AbandonedCheckoutsTable } from "./abandoned-checkouts-table";
import { RecoveryCampaigns } from "./recovery-campaigns";

export function AbandonedCheckoutsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => {
    const minValueParam = searchParams.get("minValue");
    return {
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "10", 10),
      recoverable:
        searchParams.get("recoverable") === "true" ? true : undefined,
      hasEmail: searchParams.get("hasEmail") === "true" ? true : undefined,
      minValue: minValueParam ? parseFloat(minValueParam) : undefined,
    };
  });

  const { data, isLoading, error, isError } = useAbandonedCheckouts(filters);
  const reconcile = useAdminPaymentReconcile();

  useEffect(() => {
    if (isError && error) {
      console.error("Abandoned checkouts error:", error);
    }
    if (data) {
      console.log("Abandoned checkouts data:", data);
    }
  }, [isError, error, data]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.page > 1) params.set("page", filters.page.toString());
    if (filters.limit !== 10) params.set("limit", filters.limit.toString());
    if (filters.recoverable !== undefined) params.set("recoverable", "true");
    if (filters.hasEmail !== undefined) params.set("hasEmail", "true");
    if (filters.minValue) params.set("minValue", filters.minValue.toString());

    router.replace(`/orders/abandoned?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  const handleConvert = async (checkout: AbandonedCheckout) => {
    if (!checkout.paymentIntentId) {
      toast.error("No payment intent ID found");
      return;
    }
    await reconcile.mutateAsync({ paymentIntentId: checkout.paymentIntentId });
  };

  const hasFilters =
    filters.recoverable !== undefined ||
    filters.hasEmail !== undefined ||
    filters.minValue !== undefined;

  return (
    <AdminPageLayout
      title="Abandoned Checkouts"
      description="Recover abandoned checkouts and convert them to orders"
      filters={
        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={
              filters.recoverable === undefined
                ? "all"
                : filters.recoverable
                  ? "true"
                  : "false"
            }
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                recoverable: value === "all" ? undefined : value === "true",
                page: 1,
              }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Recoverable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Recoverable</SelectItem>
              <SelectItem value="false">Unrecoverable</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={
              filters.hasEmail === undefined
                ? "all"
                : filters.hasEmail
                  ? "true"
                  : "false"
            }
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                hasEmail: value === "all" ? undefined : value === "true",
                page: 1,
              }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Has Email" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Has Email</SelectItem>
              <SelectItem value="false">No Email</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="Min value"
            value={filters.minValue || ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                minValue: e.target.value
                  ? parseFloat(e.target.value)
                  : undefined,
                page: 1,
              }))
            }
            className="w-[150px]"
          />

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFilters({
                  page: 1,
                  limit: 10,
                  recoverable: undefined,
                  hasEmail: undefined,
                  minValue: undefined,
                })
              }
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      }
    >
      {isLoading ? (
        <OrdersTableSkeleton />
      ) : isError && error ? (
        <div className="text-center py-8">
          <div className="text-destructive mb-2">
            <p className="font-medium">Error loading abandoned checkouts</p>
            <p className="text-sm mt-1">
              {error.message || "Unknown error occurred"}
            </p>
            {error.status === 504 && (
              <p className="text-xs text-muted-foreground mt-2">
                The request timed out. This might happen if there are many
                checkout sessions to scan.
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="list" className="w-full">
          <TabsList>
            <TabsTrigger value="list">Abandoned Checkouts</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="campaigns">Recovery Campaigns</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="mt-6">
            <AbandonedCheckoutsTable
              checkouts={data?.data || []}
              onConvert={handleConvert}
              isLoading={isLoading}
            />
          </TabsContent>
          <TabsContent value="analytics" className="mt-6">
            <AbandonedCartAnalytics />
          </TabsContent>
          <TabsContent value="campaigns" className="mt-6">
            <RecoveryCampaigns />
          </TabsContent>
        </Tabs>
      )}
    </AdminPageLayout>
  );
}
