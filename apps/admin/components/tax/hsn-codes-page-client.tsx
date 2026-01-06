"use client";

import { format } from "date-fns";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminHsnCodes, useDeleteHsnCode } from "@/hooks/tax/use-hsn-codes";

export function HsnCodesPageClient() {
  const { data: hsnCodes, isLoading, error } = useAdminHsnCodes();
  const deleteMutation = useDeleteHsnCode();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <AdminPageLayout
        title="HSN Codes"
        description="Manage HSN (Harmonized System of Nomenclature) codes"
        actions={
          <Button asChild size="sm" className="text-xs">
            <Link href="/tax/hsn-codes/create">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create HSN Code
            </Link>
          </Button>
        }
      >
        <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>HSN Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Default GST Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, _i) => (
                <TableRow key={`hsn-code-skeleton-${crypto.randomUUID()}`}>
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
      <AdminPageLayout title="HSN Codes" description="Error loading HSN codes">
        <div className="p-4 border border-destructive rounded-lg bg-destructive/10 text-destructive">
          Error loading HSN codes: {error.message}
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="HSN Codes"
      description="Manage HSN (Harmonized System of Nomenclature) codes"
      actions={
        <Button asChild>
          <Link href="/tax/hsn-codes/create">
            <Plus className="mr-2 h-4 w-4" />
            Create HSN Code
          </Link>
        </Button>
      }
    >
      <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
        {!hsnCodes || hsnCodes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">No HSN codes found</p>
            <p className="text-xs mb-4">Create your first HSN code</p>
            <Button asChild size="sm" className="text-xs">
              <Link href="/tax/hsn-codes/create">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Create First HSN Code
              </Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>HSN Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Default GST Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hsnCodes.map((hsn) => (
                <TableRow key={hsn.id}>
                  <TableCell className="font-medium font-mono">
                    {hsn.hsnCode}
                  </TableCell>
                  <TableCell>{hsn.description || "-"}</TableCell>
                  <TableCell>
                    {hsn.gstRate !== null ? `${hsn.gstRate}%` : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={hsn.isActive ? "default" : "secondary"}>
                      {hsn.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(hsn.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/tax/hsn-codes/${hsn.id}`}>Edit</Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deletingId === hsn.id}
                          >
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete HSN Code</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete HSN code "
                              {hsn.hsnCode}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(hsn.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
