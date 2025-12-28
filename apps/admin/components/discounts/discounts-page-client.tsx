"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Edit, MoreHorizontal, Plus, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PaginationControls } from "@/components/common/pagination-controls";
import { ProtectedButton } from "@/components/common/protected-button";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { DateTime } from "@/components/orders/date-time";
import { Money } from "@/components/orders/money";
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
import { useAdminDiscounts } from "@/hooks/discounts/use-admin-discounts";
import type { FetchError } from "@/lib/api";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { DiscountQueryParams } from "@/lib/types/discounts";

export function DiscountsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [filters, setFilters] = useState<DiscountQueryParams>({
    page: parseInt(searchParams.get("page") || "1", 10),
    limit: parseInt(searchParams.get("limit") || "10", 10),
  });

  const { data, isLoading, error, refetch } = useAdminDiscounts(filters);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.page && filters.page > 1)
      params.set("page", filters.page.toString());
    if (filters.limit && filters.limit !== 10)
      params.set("limit", filters.limit.toString());

    router.replace(`/discounts?${params.toString()}`, { scroll: false });
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

  const handleDeleteClick = (discountId: string) => {
    setDiscountToDelete(discountId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!discountToDelete) return;

    setIsDeleting(true);
    try {
      await api.delete<void>(endpoints.discounts.delete(discountToDelete));
      queryClient.invalidateQueries({ queryKey: [endpoints.discounts.list] });
      toast.success("Discount deleted successfully");
      setDeleteDialogOpen(false);
      setDiscountToDelete(null);
    } catch (_error) {
      toast.error("Failed to delete discount");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminPageLayout
      title="Discounts"
      description="Manage discount codes"
      actions={
        <ProtectedButton requiredRoles={["admin", "marketing"]}>
          <Button asChild>
            <Link href="/discounts/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Discount
            </Link>
          </Button>
        </ProtectedButton>
      }
      pagination={
        <PaginationControls
          paginationInfo={paginationInfo}
          onPreviousPage={() => handlePageChange((filters.page || 1) - 1)}
          onNextPage={() => handlePageChange((filters.page || 1) + 1)}
          canGoPrevious={data ? data.page > 1 : false}
          canGoNext={data ? data.page < data.totalPages : false}
          isLoading={isLoading}
          itemLabel="discounts"
        />
      }
    >
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Discount"
        description="Are you sure you want to delete this discount? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />

      {error && (
        <ErrorDisplay
          error={error as FetchError}
          onRetry={() => refetch()}
          className="mb-4"
        />
      )}

      {isLoading ? (
        <div className="rounded-lg border border-border/50 overflow-hidden transition-opacity duration-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-row-${String(i)}`}>
                  <TableCell className="h-10 animate-pulse bg-muted/30" />
                  <TableCell className="h-10 animate-pulse bg-muted/30" />
                  <TableCell className="h-10 animate-pulse bg-muted/30" />
                  <TableCell className="h-10 animate-pulse bg-muted/30" />
                  <TableCell className="h-10 animate-pulse bg-muted/30" />
                  <TableCell className="h-10 animate-pulse bg-muted/30" />
                  <TableCell className="h-10 animate-pulse bg-muted/30" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : data && data.data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
          <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium mb-1">No discounts found</p>
          <p className="text-xs mb-4">
            Create your first discount code to get started
          </p>
          <ProtectedButton requiredRoles={["admin", "marketing"]}>
            <Button asChild size="sm">
              <Link href="/discounts/create">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Create Discount
              </Link>
            </Button>
          </ProtectedButton>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden transition-all duration-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((discount) => (
                <TableRow key={discount.id} className="group">
                  <TableCell className="font-medium">{discount.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {discount.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {discount.valueType === "PERCENTAGE" ? (
                      `${discount.value}%`
                    ) : (
                      <Money amount={discount.value} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={discount.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {discount.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {discount.usageLimit
                      ? `${discount.usageCount}/${discount.usageLimit}`
                      : discount.usageCount}
                  </TableCell>
                  <TableCell>
                    <DateTime date={discount.createdAt} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem asChild>
                          <Link href={`/discounts/${discount.id}`}>
                            <Edit className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(discount.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
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
