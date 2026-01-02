"use client";

import {
  ArrowLeft,
  Edit,
  FileText,
  Filter,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PaginationControls } from "@/components/common/pagination-controls";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminContentType } from "@/hooks/cms/use-admin-content-types";
import { useAdminDeleteEntry } from "@/hooks/cms/use-admin-delete-entry";
import { useAdminEntries } from "@/hooks/cms/use-admin-entries";
import { useDebounce } from "@/hooks/use-debounce";
import type { Entry, ListEntriesQueryParams } from "@/lib/types/cms";
import { WorkflowStatusIndicator } from "./workflow-status-indicator";

interface EntriesPageClientProps {
  contentTypeId: string;
}

/**
 * Client component for entries list page
 * Handles all client-side logic including state management and interactions
 */
export function EntriesPageClient({ contentTypeId }: EntriesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null);
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || "",
  );

  // Parse initial filters from URL
  const initialFilters = useMemo<ListEntriesQueryParams>(() => {
    return {
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
      status:
        (searchParams.get("status") as "draft" | "review" | "published") ||
        undefined,
      search: searchParams.get("search") || undefined,
      sortBy:
        (searchParams.get("sortBy") as "newest" | "oldest" | "alphabetical") ||
        "newest",
    };
  }, [searchParams]);

  const [filters, setFilters] =
    useState<ListEntriesQueryParams>(initialFilters);

  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 500);

  // Update filters when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters((prev) => ({
        ...prev,
        search: debouncedSearch || undefined,
        page: 1, // Reset to first page on search
      }));
    }
  }, [debouncedSearch, filters.search]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.page && filters.page > 1) {
      params.set("page", filters.page.toString());
    }
    if (filters.limit && filters.limit !== 20) {
      params.set("limit", filters.limit.toString());
    }
    if (filters.status) {
      params.set("status", filters.status);
    }
    if (filters.search) {
      params.set("search", filters.search);
    }
    if (filters.sortBy && filters.sortBy !== "newest") {
      params.set("sortBy", filters.sortBy);
    }
    const queryString = params.toString();
    const newUrl = queryString
      ? `/cms/content-types/${contentTypeId}/entries?${queryString}`
      : `/cms/content-types/${contentTypeId}/entries`;
    router.replace(newUrl, { scroll: false });
  }, [filters, contentTypeId, router]);

  const { data: contentType, isLoading: isLoadingContentType } =
    useAdminContentType(contentTypeId);
  const {
    data: entriesData,
    isLoading,
    error,
    refetch,
  } = useAdminEntries(contentTypeId, filters);
  const deleteMutation = useAdminDeleteEntry(contentTypeId);

  const handleDeleteClick = useCallback((entry: Entry) => {
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (entryToDelete) {
      deleteMutation.mutate(entryToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setEntryToDelete(null);
        },
      });
    }
  }, [entryToDelete, deleteMutation]);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handleStatusFilter = useCallback(
    (status: "draft" | "published" | "all") => {
      setFilters((prev) => ({
        ...prev,
        status: status === "all" ? undefined : status,
        page: 1,
      }));
    },
    [],
  );

  const handleSortChange = useCallback(
    (sortBy: "newest" | "oldest" | "alphabetical") => {
      setFilters((prev) => ({ ...prev, sortBy, page: 1 }));
    },
    [],
  );

  const paginationInfo = entriesData
    ? {
        startItem:
          (entriesData.pagination.page - 1) * entriesData.pagination.limit + 1,
        endItem: Math.min(
          entriesData.pagination.page * entriesData.pagination.limit,
          entriesData.pagination.total,
        ),
        total: entriesData.pagination.total,
        currentPage: entriesData.pagination.page,
        totalPages: entriesData.pagination.totalPages,
      }
    : null;

  // Get display fields from schema
  const displayFields = contentType?.schema.displayFields || [];
  const firstDisplayField =
    displayFields.length > 0
      ? displayFields[0]
      : contentType?.schema.fields[0]?.name;

  // Render field value for table display
  const renderFieldValue = (entry: Entry, fieldName: string) => {
    const value = entry.data[fieldName];
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">—</span>;
    }
    if (typeof value === "string") {
      return value.length > 50 ? `${value.substring(0, 50)}...` : value;
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    return String(value);
  };

  if (isLoadingContentType) {
    return <EntriesTableSkeleton />;
  }

  return (
    <>
      <AdminPageLayout
        title={contentType?.displayName || "Entries"}
        description={`Manage ${contentType?.displayName.toLowerCase() || "content"} entries`}
        breadcrumbs={[
          { label: "CMS", href: "/cms/content-types" },
          { label: contentType?.displayName || "Content Type" },
          { label: "Entries" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/cms/content-types">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/cms/content-types/${contentTypeId}/entries/create`}>
                <Plus className="mr-2 h-4 w-4" />
                Create Entry
              </Link>
            </Button>
          </div>
        }
        filters={
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entries..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  handleStatusFilter(value as "draft" | "published" | "all")
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="review">In Review</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.sortBy || "newest"}
                onValueChange={(value) =>
                  handleSortChange(
                    value as "newest" | "oldest" | "alphabetical",
                  )
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        pagination={
          paginationInfo && (
            <PaginationControls
              paginationInfo={paginationInfo}
              onPreviousPage={() =>
                handlePageChange(paginationInfo.currentPage - 1)
              }
              onNextPage={() =>
                handlePageChange(paginationInfo.currentPage + 1)
              }
              canGoPrevious={paginationInfo.currentPage > 1}
              canGoNext={paginationInfo.currentPage < paginationInfo.totalPages}
              isLoading={isLoading}
              itemLabel="entries"
            />
          )
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={entriesData}
          loadingComponent={<EntriesTableSkeleton />}
          emptyComponent={
            <EmptyEntriesState
              hasFilters={!!(filters.search || filters.status)}
              contentTypeName={contentType?.displayName}
              contentTypeId={contentTypeId}
            />
          }
          onRetry={() => refetch()}
        >
          <div className="rounded-lg border border-border/50 overflow-hidden transition-all duration-200">
            <Table>
              <TableHeader>
                <TableRow>
                  {firstDisplayField && (
                    <TableHead>
                      {contentType?.schema.fields.find(
                        (f) => f.name === firstDisplayField,
                      )?.name || "Name"}
                    </TableHead>
                  )}
                  <TableHead>Status</TableHead>
                  <TableHead>Updated At</TableHead>
                  <TableHead>Updated By</TableHead>
                  <TableHead>Published Version</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesData?.data.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/cms/entries/${entry.id}/edit`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/cms/entries/${entry.id}/edit`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {firstDisplayField && (
                      <TableCell className="font-medium">
                        {renderFieldValue(entry, firstDisplayField)}
                      </TableCell>
                    )}
                    <TableCell>
                      <WorkflowStatusIndicator
                        status={
                          (entry.currentWorkflowStatus || entry.status) as
                            | "draft"
                            | "review"
                            | "published"
                        }
                        variant="compact"
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(entry.updatedAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {entry.updatedBy || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.publishedAt ? (
                        <span className="text-sm text-muted-foreground">
                          {new Date(entry.publishedAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                            <Filter className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link href={`/cms/entries/${entry.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(entry);
                            }}
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
        </QueryState>
      </AdminPageLayout>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be
              undone.
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
 * Skeleton loader for entries table
 */
function EntriesTableSkeleton() {
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated At</TableHead>
            <TableHead>Updated By</TableHead>
            <TableHead>Published Version</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton loader, index is stable and items don't change
            <TableRow key={`skeleton-${i}`}>
              <TableCell>
                <Skeleton className="h-4 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
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
 * Empty state for entries
 */
function EmptyEntriesState({
  hasFilters,
  contentTypeName,
  contentTypeId,
}: {
  hasFilters: boolean;
  contentTypeName?: string;
  contentTypeId?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">
        {hasFilters ? "No entries found" : "No entries yet"}
      </h3>
      <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
        {hasFilters
          ? "Try adjusting your filters to see more results."
          : `Get started by creating your first ${contentTypeName?.toLowerCase() || "entry"}.`}
      </p>
      {!hasFilters && contentTypeId && (
        <Button asChild>
          <Link href={`/cms/content-types/${contentTypeId}/entries/create`}>
            <Plus className="mr-2 h-4 w-4" />
            Create Entry
          </Link>
        </Button>
      )}
    </div>
  );
}
