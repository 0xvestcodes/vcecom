"use client";

import { useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import { useIncomingWebhooks } from "@/hooks/webhooks/use-webhooks";
import { PaginationControls } from "../common/pagination-controls";

export function IncomingWebhooksPageClient() {
  const [filters, setFilters] = useState({
    provider: undefined as
      | "razorpay"
      | "shiprocket"
      | "nimbus_post"
      | "generic"
      | undefined,
    status: undefined as "pending" | "processed" | "failed" | undefined,
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading } = useIncomingWebhooks(filters);

  // Transform PaginatedResponse to PaginationData
  const paginationData = data
    ? {
        page: data.pagination.page,
        limit: data.pagination.pageSize,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
        hasNextPage: data.pagination.page < data.pagination.totalPages,
        hasPreviousPage: data.pagination.page > 1,
      }
    : undefined;

  const pagination = usePagination(paginationData, (page) =>
    setFilters((prev) => ({ ...prev, page })),
  );

  return (
    <AdminPageLayout
      title="Incoming Webhooks"
      description="View webhooks received from payment and shipping providers"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Webhooks", href: "/settings/webhooks" },
        { label: "Incoming" },
      ]}
      pagination={
        <PaginationControls
          paginationInfo={pagination.paginationInfo}
          onPreviousPage={pagination.handlePreviousPage}
          onNextPage={pagination.handleNextPage}
          canGoPrevious={pagination.canGoPrevious}
          canGoNext={pagination.canGoNext}
        />
      }
    >
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : !data?.items.length ? (
        <div className="text-center py-12 text-muted-foreground">
          No incoming webhooks found
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell>
                    <Badge variant="outline">{webhook.provider}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {webhook.eventType}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        webhook.status === "processed"
                          ? "default"
                          : webhook.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {webhook.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(webhook.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminPageLayout>
  );
}
