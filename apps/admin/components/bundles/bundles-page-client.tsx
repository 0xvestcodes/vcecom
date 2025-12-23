"use client";

import { Edit, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PaginationControls } from "@/components/common/pagination-controls";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { DateTime } from "@/components/orders/date-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorDisplay } from "@/components/ui/error-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminBundles } from "@/hooks/bundles/use-admin-bundles";
import { useAdminDeleteBundle } from "@/hooks/bundles/use-admin-delete-bundle";
import type { FetchError } from "@/lib/api";
import type { BundleQueryParams } from "@/lib/types/bundles";

export function BundlesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deleteBundle = useAdminDeleteBundle();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<string | null>(null);

  const [filters, setFilters] = useState<BundleQueryParams>({
    page: parseInt(searchParams.get("page") || "1", 10),
    limit: parseInt(searchParams.get("limit") || "10", 10),
  });

  const { data, isLoading, error, refetch } = useAdminBundles(filters);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.page && filters.page > 1)
      params.set("page", filters.page.toString());
    if (filters.limit && filters.limit !== 10)
      params.set("limit", filters.limit.toString());

    router.replace(`/bundles?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const paginationInfo = data
    ? {
        startItem: (data.page - 1) * data.limit + 1,
        endItem: Math.min(data.page * data.limit, data.total),
        total: data.total,
        currentPage: data.page,
        totalPages: data.totalPages,
      }
    : null;

  const handleDeleteClick = (bundleId: string) => {
    setBundleToDelete(bundleId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (bundleToDelete) {
      await deleteBundle.mutateAsync(bundleToDelete);
      setDeleteDialogOpen(false);
      setBundleToDelete(null);
    }
  };

  return (
    <AdminPageLayout
      title="Bundles"
      description="Manage product bundles"
      actions={
        <Button asChild>
          <Link href="/bundles/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Bundle
          </Link>
        </Button>
      }
      pagination={
        <PaginationControls
          paginationInfo={paginationInfo}
          onPreviousPage={() => handlePageChange((filters.page || 1) - 1)}
          onNextPage={() => handlePageChange((filters.page || 1) + 1)}
          canGoPrevious={data ? data.page > 1 : false}
          canGoNext={data ? data.page < data.totalPages : false}
          isLoading={isLoading}
          itemLabel="bundles"
        />
      }
    >
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Bundle"
        description="Are you sure you want to delete this bundle? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteBundle.isPending}
      />

      {error && (
        <ErrorDisplay
          error={error as FetchError}
          onRetry={() => refetch()}
          className="mb-4"
        />
      )}

      {isLoading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sets</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-row-${String(i)}`}>
                  <TableCell className="h-12 animate-pulse bg-muted" />
                  <TableCell className="h-12 animate-pulse bg-muted" />
                  <TableCell className="h-12 animate-pulse bg-muted" />
                  <TableCell className="h-12 animate-pulse bg-muted" />
                  <TableCell className="h-12 animate-pulse bg-muted" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : data && data.data.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-lg font-medium mb-2">No bundles found</p>
          <p className="text-sm mb-4">Create your first bundle</p>
          <Button asChild>
            <Link href="/bundles/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Bundle
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sets</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((bundle) => (
                <TableRow key={bundle.id}>
                  <TableCell className="font-medium">{bundle.title}</TableCell>
                  <TableCell>
                    <Badge variant={bundle.isActive ? "default" : "secondary"}>
                      {bundle.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{bundle.sets?.length || 0}</TableCell>
                  <TableCell>
                    <DateTime date={bundle.createdAt} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/bundles/${bundle.id}`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(bundle.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
