"use client";

import {
  FileText,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Power,
  PowerOff,
  Trash2,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import {
  useDeleteWebhook,
  useDisableWebhook,
  useEnableWebhook,
  useTestWebhook,
  useWebhooks,
} from "@/hooks/webhooks/use-webhooks";
import { PaginationControls } from "../common/pagination-controls";

export function WebhooksPageClient() {
  const [filters, setFilters] = useState({
    isActive: undefined as boolean | undefined,
    eventType: undefined as string | undefined,
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading, error } = useWebhooks(filters);
  const deleteWebhook = useDeleteWebhook();
  const enableWebhook = useEnableWebhook();
  const disableWebhook = useDisableWebhook();
  const testWebhook = useTestWebhook();

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

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this webhook?")) {
      await deleteWebhook.mutateAsync(id);
    }
  };

  const handleEnable = async (id: string) => {
    await enableWebhook.mutateAsync(id);
  };

  const handleDisable = async (id: string) => {
    await disableWebhook.mutateAsync(id);
  };

  const handleTest = async (id: string) => {
    await testWebhook.mutateAsync({ id });
    alert("Test webhook queued for delivery");
  };

  return (
    <AdminPageLayout
      title="Webhooks"
      description="Manage outgoing webhooks for order, product, and customer events"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Webhooks" },
      ]}
      actions={
        <Button asChild>
          <Link href="/settings/webhooks/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Webhook
          </Link>
        </Button>
      }
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
      ) : error ? (
        <div className="text-center py-8 text-destructive">
          Error loading webhooks
        </div>
      ) : !data?.items.length ? (
        <div className="text-center py-12">
          <Webhook className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No webhooks</h3>
          <p className="text-muted-foreground mb-4">
            Get started by creating your first webhook
          </p>
          <Button asChild>
            <Link href="/settings/webhooks/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Webhook
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell className="font-medium">{webhook.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {webhook.url}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.slice(0, 2).map((event) => (
                        <Badge
                          key={event}
                          variant="outline"
                          className="text-xs"
                        >
                          {event}
                        </Badge>
                      ))}
                      {webhook.events.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{webhook.events.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={webhook.isActive ? "default" : "secondary"}>
                      {webhook.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/settings/webhooks/${webhook.id}/edit`}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTest(webhook.id)}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Test
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/settings/webhooks/${webhook.id}/logs`}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              View Logs
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              webhook.isActive
                                ? handleDisable(webhook.id)
                                : handleEnable(webhook.id)
                            }
                          >
                            {webhook.isActive ? (
                              <>
                                <PowerOff className="mr-2 h-4 w-4" />
                                Disable
                              </>
                            ) : (
                              <>
                                <Power className="mr-2 h-4 w-4" />
                                Enable
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(webhook.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
