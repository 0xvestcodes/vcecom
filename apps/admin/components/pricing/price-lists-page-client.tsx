"use client";

import { DollarSign, Edit, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { useAdminDeletePriceList } from "@/hooks/pricing/use-admin-delete-price-list";
import { useAdminPriceLists } from "@/hooks/pricing/use-admin-price-lists";
import type { FetchError } from "@/lib/api";

export function PriceListsPageClient() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceListToDelete, setPriceListToDelete] = useState<string | null>(
    null,
  );
  const {
    data: priceListsResponse,
    isLoading,
    error,
    refetch,
  } = useAdminPriceLists();
  const priceLists = priceListsResponse?.data || [];

  const deletePriceList = useAdminDeletePriceList(priceListToDelete || "");

  const handleDeleteClick = (priceListId: string) => {
    setPriceListToDelete(priceListId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (priceListToDelete) {
      try {
        await deletePriceList.mutateAsync();
        setDeleteDialogOpen(false);
        setPriceListToDelete(null);
      } catch (_error) {
        // Error handled by hook
      }
    }
  };

  return (
    <AdminPageLayout
      title="Price Lists"
      description="Manage price lists for customer groups"
      actions={
        <Button asChild size="sm" className="text-xs">
          <Link href="/price-lists/create">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Create Price List
          </Link>
        </Button>
      }
    >
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Price List"
        description="Are you sure you want to delete this price list? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deletePriceList.isPending}
      />

      {error && (
        <ErrorDisplay
          error={error as FetchError}
          onRetry={() => refetch()}
          className="mb-4"
        />
      )}

      {isLoading ? (
        <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : priceLists && priceLists.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
          <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium mb-1">No price lists found</p>
          <p className="text-xs mb-4">Create your first price list</p>
          <Button asChild size="sm" className="text-xs">
            <Link href="/price-lists/create">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create Price List
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceLists?.map((priceList) => (
                <TableRow
                  key={priceList.id}
                  className="group hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="font-medium text-xs">
                    {priceList.name}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant={priceList.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {priceList.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {priceList.items?.length || 0}
                  </TableCell>
                  <TableCell className="text-xs">
                    <DateTime date={priceList.createdAt} />
                  </TableCell>
                  <TableCell className="text-xs">
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
                          <Link href={`/price-lists/${priceList.id}`}>
                            <Edit className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(priceList.id)}
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
