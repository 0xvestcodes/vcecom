"use client";

import { Eye, FileText, Plus, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ProtectedButton } from "@/components/common/protected-button";
import { QueryState } from "@/components/common/query-state";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminContentTypes } from "@/hooks/cms/use-admin-content-types";
import { useAdminDeleteContentType } from "@/hooks/cms/use-admin-delete-content-type";
import type { ContentType } from "@/lib/types/cms";

/**
 * Client component for content types list page
 * Handles all client-side logic including state management and interactions
 */
export function ContentTypesPageClient() {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contentTypeToDelete, setContentTypeToDelete] =
    useState<ContentType | null>(null);

  const {
    data: contentTypes,
    isLoading,
    error,
    refetch,
  } = useAdminContentTypes();
  const deleteMutation = useAdminDeleteContentType();

  const handleDeleteClick = useCallback((contentType: ContentType) => {
    setContentTypeToDelete(contentType);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (contentTypeToDelete) {
      deleteMutation.mutate(contentTypeToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setContentTypeToDelete(null);
        },
      });
    }
  }, [contentTypeToDelete, deleteMutation]);

  const getContentTypeIcon = (_icon?: string | null) => {
    // You can expand this to use actual icons based on icon string
    return <FileText className="h-5 w-5" />;
  };

  return (
    <>
      <AdminPageLayout
        title="Content Types"
        description="Manage your content types and their schemas"
        actions={
          <ProtectedButton requiredRoles={["admin"]}>
            <Button asChild>
              <Link href="/cms/content-types/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Content Type
              </Link>
            </Button>
          </ProtectedButton>
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={contentTypes}
          loadingComponent={<ContentTypesTableSkeleton />}
          emptyComponent={<EmptyContentTypesState />}
          onRetry={() => refetch()}
        >
          <div className="rounded-lg border border-border/50 overflow-hidden transition-all duration-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contentTypes?.map((contentType) => (
                  <TableRow
                    key={contentType.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/cms/content-types/${contentType.id}/entries`,
                      )
                    }
                  >
                    <TableCell>
                      <div
                        className="flex items-center justify-center w-10 h-10 rounded-lg"
                        style={{
                          backgroundColor: contentType.color
                            ? `${contentType.color}20`
                            : undefined,
                        }}
                      >
                        {getContentTypeIcon(contentType.icon)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {contentType.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {contentType.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {contentType.isSingleton && (
                          <Badge variant="secondary" className="text-xs">
                            Singleton
                          </Badge>
                        )}
                        {contentType.isCollection && (
                          <Badge variant="outline" className="text-xs">
                            Collection
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {contentType.entryCount ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {contentType.schema.fields.length} field
                        {contentType.schema.fields.length !== 1 ? "s" : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(contentType.updatedAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <span className="sr-only">Open menu</span>
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link
                              href={`/cms/content-types/${contentType.id}/entries`}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Entries
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link
                              href={`/cms/content-types/${contentType.id}/entries/create`}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Create Entry
                            </Link>
                          </DropdownMenuItem>
                          <ProtectedButton requiredRoles={["admin"]}>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(contentType);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </ProtectedButton>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </QueryState>
      </AdminPageLayout>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "
              {contentTypeToDelete?.displayName}
              "? This action cannot be undone.
              {contentTypeToDelete?.entryCount
                ? ` This content type has ${contentTypeToDelete.entryCount} entries. You must delete all entries first.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Skeleton loader for content types table
 */
function ContentTypesTableSkeleton() {
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Entries</TableHead>
            <TableHead>Fields</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton loader, index is stable and items don't change
            <TableRow key={`skeleton-${i}`}>
              <TableCell>
                <Skeleton className="h-10 w-10 rounded-lg" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Empty state for content types
 */
function EmptyContentTypesState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No content types</h3>
      <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
        Get started by creating your first content type. Content types define
        the structure and fields for your content entries.
      </p>
      <ProtectedButton requiredRoles={["admin"]}>
        <Button asChild>
          <Link href="/cms/content-types/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Content Type
          </Link>
        </Button>
      </ProtectedButton>
    </div>
  );
}
