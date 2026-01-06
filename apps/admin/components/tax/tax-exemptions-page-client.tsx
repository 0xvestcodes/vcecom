"use client";

import { format } from "date-fns";
import { Plus, Receipt } from "lucide-react";
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
import {
  useAdminTaxExemptions,
  useDeleteTaxExemption,
} from "@/hooks/tax/use-tax-exemptions";

export function TaxExemptionsPageClient() {
  const { data: exemptions, isLoading, error } = useAdminTaxExemptions();
  const deleteMutation = useDeleteTaxExemption();
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
        title="Tax Exemptions"
        description="Manage tax exemptions for customers and products"
        actions={
          <Button asChild size="sm" className="text-xs">
            <Link href="/tax/exemptions/create">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create Exemption
            </Link>
          </Button>
        }
      >
        <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Certificate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, _i) => (
                <TableRow key={`tax-exemption-skeleton-${crypto.randomUUID()}`}>
                  <TableCell colSpan={7}>
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
        title="Tax Exemptions"
        description="Error loading tax exemptions"
      >
        <div className="p-4 border border-destructive rounded-lg bg-destructive/10 text-destructive">
          Error loading tax exemptions: {error.message}
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Tax Exemptions"
      description="Manage tax exemptions for customers and products"
      actions={
        <Button asChild>
          <Link href="/tax/exemptions/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Exemption
          </Link>
        </Button>
      }
    >
      <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
        {!exemptions || exemptions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">No tax exemptions found</p>
            <p className="text-xs mb-4">Create your first tax exemption</p>
            <Button asChild size="sm" className="text-xs">
              <Link href="/tax/exemptions/create">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Create First Exemption
              </Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Certificate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exemptions.map((exemption) => (
                <TableRow key={exemption.id}>
                  <TableCell className="font-medium">
                    {exemption.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{exemption.exemptionType}</Badge>
                  </TableCell>
                  <TableCell>{exemption.exemptionReason || "-"}</TableCell>
                  <TableCell>{exemption.certificateNumber || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={exemption.isActive ? "default" : "secondary"}
                    >
                      {exemption.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(exemption.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/tax/exemptions/${exemption.id}`}>
                          Edit
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deletingId === exemption.id}
                          >
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete Tax Exemption
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{exemption.name}
                              "? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(exemption.id)}
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
