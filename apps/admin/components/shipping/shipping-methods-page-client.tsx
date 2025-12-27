"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Edit, MoreHorizontal, Plus, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { QueryState } from "@/components/common/query-state";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { useAdminDeleteShippingMethod } from "@/hooks/shipping/use-admin-delete-shipping-method";
import { useAdminShippingMethods } from "@/hooks/shipping/use-admin-shipping-methods";

export function ShippingMethodsPageClient() {
  const _queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const {
    data: methods,
    isLoading,
    error,
    refetch,
  } = useAdminShippingMethods(includeInactive);
  const deleteMethod = useAdminDeleteShippingMethod();

  const handleDeleteClick = (methodId: string) => {
    setMethodToDelete(methodId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!methodToDelete) return;

    try {
      await deleteMethod.mutateAsync(methodToDelete);
      setDeleteDialogOpen(false);
      setMethodToDelete(null);
    } catch (_error) {
      // Error is handled by the hook
    }
  };

  return (
    <AdminPageLayout
      title="Shipping Methods"
      description="Manage shipping methods available during checkout"
      actions={
        <Button asChild size="sm" className="text-xs">
          <Link href="/settings/shipping-methods/create">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Create Shipping Method
          </Link>
        </Button>
      }
    >
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Shipping Method"
        description="Are you sure you want to delete this shipping method? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMethod.isPending}
      />

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={includeInactive ? "outline" : "default"}
            size="sm"
            onClick={() => setIncludeInactive(false)}
          >
            Active Only
          </Button>
          <Button
            variant={includeInactive ? "default" : "outline"}
            size="sm"
            onClick={() => setIncludeInactive(true)}
          >
            All Methods
          </Button>
        </div>
      </div>

      <QueryState
        isLoading={isLoading}
        error={error}
        data={methods}
        loadingComponent={<TableSkeleton columns={6} rows={5} />}
        emptyComponent={
          <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">
              {includeInactive
                ? "No shipping methods found"
                : "No active shipping methods found"}
            </p>
            <p className="text-xs">Create your first shipping method</p>
          </div>
        }
        onRetry={() => refetch()}
      >
        {methods && methods.length > 0 && (
          <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Base Rate</TableHead>
                  <TableHead>Est. Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((method) => (
                  <TableRow
                    key={method.id}
                    className="group hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-medium text-xs">
                      {method.name}
                    </TableCell>
                    <TableCell className="text-xs">
                      <code className="rounded bg-muted/50 px-2 py-1 text-xs">
                        {method.code}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs">
                      ₹{(method.baseRate / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {method.estimatedDays} days
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge
                        variant={method.isActive ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {method.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{method.priority}</TableCell>
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
                            <Link
                              href={`/settings/shipping-methods/${method.id}`}
                            >
                              <Edit className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(method.id)}
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
      </QueryState>
    </AdminPageLayout>
  );
}
