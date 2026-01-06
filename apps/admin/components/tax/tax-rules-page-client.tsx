"use client";

import { format } from "date-fns";
import { Percent, Plus } from "lucide-react";
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
import { useAdminTaxRules, useDeleteTaxRule } from "@/hooks/tax/use-tax-rules";

export function TaxRulesPageClient() {
  const { data: rules, isLoading, error } = useAdminTaxRules();
  const deleteMutation = useDeleteTaxRule();
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
        title="Tax Rules"
        description="Manage tax rate overrides at different levels"
        actions={
          <Button asChild size="sm" className="text-xs">
            <Link href="/tax/rules/create">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create Rule
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
                <TableHead>GST Rate</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, _i) => (
                <TableRow key={`tax-rule-skeleton-${crypto.randomUUID()}`}>
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
      <AdminPageLayout title="Tax Rules" description="Error loading tax rules">
        <div className="p-4 border border-destructive rounded-lg bg-destructive/10 text-destructive">
          Error loading tax rules: {error.message}
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Tax Rules"
      description="Manage tax rate overrides at different levels"
      actions={
        <Button asChild>
          <Link href="/tax/rules/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Link>
        </Button>
      }
    >
      <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
        {!rules || rules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
            <Percent className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">No tax rules found</p>
            <p className="text-xs mb-4">Create your first tax rule</p>
            <Button asChild size="sm" className="text-xs">
              <Link href="/tax/rules/create">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Create First Rule
              </Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>GST Rate</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.ruleType}</Badge>
                  </TableCell>
                  <TableCell>{rule.gstRate}%</TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(rule.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/tax/rules/${rule.id}`}>Edit</Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deletingId === rule.id}
                          >
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Tax Rule</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{rule.name}"?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(rule.id)}
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
