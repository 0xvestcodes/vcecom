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
import { useWebhookLogs } from "@/hooks/webhooks/use-webhooks";
import { PaginationControls } from "../common/pagination-controls";

interface WebhookLogsPageClientProps {
  webhookId: string;
}

export function WebhookLogsPageClient({
  webhookId,
}: WebhookLogsPageClientProps) {
  const [filters, setFilters] = useState({
    status: undefined as "pending" | "success" | "failed" | undefined,
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading } = useWebhookLogs(webhookId, filters);

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
      title="Webhook Delivery Logs"
      description="View delivery history and attempt details"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Webhooks", href: "/settings/webhooks" },
        { label: "Logs" },
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
          No delivery logs found
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Delivered At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.eventType}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.eventId}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.status === "success"
                          ? "default"
                          : log.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.attemptCount}</TableCell>
                  <TableCell>
                    {log.responseStatus ? (
                      <span
                        className={
                          log.responseStatus >= 200 && log.responseStatus < 300
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {log.responseStatus}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {log.deliveredAt
                      ? new Date(log.deliveredAt).toLocaleString()
                      : "-"}
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
