"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileSearch } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { endpoints } from "@/lib/endpoints";
import type { TaxAuditLog } from "@/lib/types/tax";

async function fetchTaxAuditLogs(params: {
  orderId?: string;
  cartId?: string;
  customerId?: string;
  event?: string;
}): Promise<TaxAuditLog[]> {
  const queryParams = new URLSearchParams();
  if (params.orderId) queryParams.append("orderId", params.orderId);
  if (params.cartId) queryParams.append("cartId", params.cartId);
  if (params.customerId) queryParams.append("customerId", params.customerId);
  if (params.event) queryParams.append("event", params.event);

  const url = `${endpoints.tax.audit.list}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await fetch(url, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch tax audit logs");
  }
  return response.json();
}

export function TaxAuditLogsPageClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || undefined;
  const cartId = searchParams.get("cartId") || undefined;
  const customerId = searchParams.get("customerId") || undefined;
  const event = searchParams.get("event") || undefined;

  const {
    data: logs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tax-audit-logs", orderId, cartId, customerId, event],
    queryFn: () => fetchTaxAuditLogs({ orderId, cartId, customerId, event }),
  });

  if (isLoading) {
    return (
      <AdminPageLayout
        title="Tax Audit Logs"
        description="View tax calculation audit trail"
      >
        <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>GST Rate</TableHead>
                <TableHead>Tax Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, _i) => (
                <TableRow key={`tax-audit-skeleton-${crypto.randomUUID()}`}>
                  <TableCell colSpan={6}>
                    <div className="h-10 bg-muted/30 animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AdminPageLayout>
    );
  }

  if (error) {
    return (
      <AdminPageLayout
        title="Tax Audit Logs"
        description="Error loading tax audit logs"
      >
        <div className="p-4 border border-destructive rounded-lg bg-destructive/10 text-destructive">
          Error loading tax audit logs: {error.message}
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Tax Audit Logs"
      description="View tax calculation audit trail"
    >
      <div className="mb-4 p-4 border rounded-lg bg-card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor="order-id-filter"
              className="text-sm font-medium mb-1 block"
            >
              Order ID
            </label>
            <Input
              id="order-id-filter"
              placeholder="Filter by order ID"
              defaultValue={orderId}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const value = e.currentTarget.value;
                  window.location.href = value
                    ? `/tax/audit?orderId=${value}`
                    : "/tax/audit";
                }
              }}
            />
          </div>
          <div>
            <label
              htmlFor="cart-id-filter"
              className="text-sm font-medium mb-1 block"
            >
              Cart ID
            </label>
            <Input
              id="cart-id-filter"
              placeholder="Filter by cart ID"
              defaultValue={cartId}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const value = e.currentTarget.value;
                  window.location.href = value
                    ? `/tax/audit?cartId=${value}`
                    : "/tax/audit";
                }
              }}
            />
          </div>
          <div>
            <label
              htmlFor="customer-id-filter"
              className="text-sm font-medium mb-1 block"
            >
              Customer ID
            </label>
            <Input
              id="customer-id-filter"
              placeholder="Filter by customer ID"
              defaultValue={customerId}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const value = e.currentTarget.value;
                  window.location.href = value
                    ? `/tax/audit?customerId=${value}`
                    : "/tax/audit";
                }
              }}
            />
          </div>
          <div>
            <label
              htmlFor="event-filter"
              className="text-sm font-medium mb-1 block"
            >
              Event
            </label>
            <Input
              id="event-filter"
              placeholder="Filter by event"
              defaultValue={event}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const value = e.currentTarget.value;
                  window.location.href = value
                    ? `/tax/audit?event=${value}`
                    : "/tax/audit";
                }
              }}
            />
          </div>
        </div>
        {(orderId || cartId || customerId || event) && (
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/tax/audit";
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
      <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
        {!logs || logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
            <FileSearch className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">No tax audit logs found</p>
            <p className="text-xs">
              Tax audit logs will appear here when tax calculations are
              performed
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>GST Rate</TableHead>
                <TableHead>Tax Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.event}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.severity === "CRITICAL"
                          ? "destructive"
                          : log.severity === "WARNING"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {log.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.orderId || "-"}
                  </TableCell>
                  <TableCell>
                    {log.resolvedGstRate !== null
                      ? `${log.resolvedGstRate}%`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {log.taxAmount !== null
                      ? `₹${log.taxAmount.toFixed(2)}`
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminPageLayout>
  );
}
