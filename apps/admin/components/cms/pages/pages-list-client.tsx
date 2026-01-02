"use client";

import { formatDistanceToNow } from "date-fns";
import { Copy, Edit, Eye, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PaginationControls } from "@/components/common/pagination-controls";
import { QueryState } from "@/components/common/query-state";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminContentTypes } from "@/hooks/cms/use-admin-content-types";
import { useAdminEntries } from "@/hooks/cms/use-admin-entries";
import { useDebounce } from "@/hooks/use-debounce";
import { CMS_STATUS_LABELS } from "@/lib/constants/cms-actions.constants";
import type { Entry, ListEntriesQueryParams } from "@/lib/types/cms";

/**
 * Client component for pages list
 * Shows all CMS pages with filtering and search
 */
export function PagesListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || "",
  );

  // Find "page" content type
  const { data: contentTypes } = useAdminContentTypes();
  const pageContentType = contentTypes?.find(
    (ct) => ct.name === "page" || ct.displayName.toLowerCase() === "page",
  );
  const contentTypeId = pageContentType?.id || "";

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
  const debouncedSearch = useDebounce(searchInput, 500);

  // Update filters when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters((prev) => ({
        ...prev,
        search: debouncedSearch || undefined,
        page: 1,
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
    const newUrl = queryString ? `/cms/pages?${queryString}` : `/cms/pages`;
    router.replace(newUrl, { scroll: false });
  }, [filters, router]);

  const {
    data: entriesData,
    isLoading,
    error,
  } = useAdminEntries(contentTypeId, filters);

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

  // Get page title from entry data
  const getPageTitle = (entry: Entry) => {
    return (
      (entry.data.title as string) ||
      (entry.data.name as string) ||
      "Untitled Page"
    );
  };

  // Get page URL/slug
  const getPageUrl = (entry: Entry) => {
    if (entry.slug) {
      return `/${entry.slug}`;
    }
    return entry.data.slug ? `/${entry.data.slug}` : "#";
  };

  // Get status badge
  const getStatusBadge = (entry: Entry) => {
    const status = (entry.currentWorkflowStatus || entry.status) as
      | "draft"
      | "review"
      | "published";
    const variant =
      status === "published"
        ? "default"
        : status === "review"
          ? "secondary"
          : "outline";
    return <Badge variant={variant}>{CMS_STATUS_LABELS[status]}</Badge>;
  };

  if (!contentTypeId && contentTypes) {
    return (
      <AdminPageLayout title="Pages" description="Manage CMS pages">
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Page content type not found. Please create a "page" content type
            first.
          </p>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Pages"
      description="Manage your CMS pages"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Pages" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/cms/pages/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Page
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
                placeholder="Search by title or URL..."
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
                handleSortChange(value as "newest" | "oldest" | "alphabetical")
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
            onNextPage={() => handlePageChange(paginationInfo.currentPage + 1)}
            canGoPrevious={paginationInfo.currentPage > 1}
            canGoNext={paginationInfo.currentPage < paginationInfo.totalPages}
            isLoading={isLoading}
            itemLabel="pages"
          />
        )
      }
    >
      <QueryState
        isLoading={isLoading}
        error={error}
        data={entriesData}
        emptyComponent={
          <div className="text-center py-8 text-muted-foreground">
            No pages found
          </div>
        }
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page Title</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated By</TableHead>
                <TableHead>Updated At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entriesData?.data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {getPageTitle(entry)}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {getPageUrl(entry)}
                    </code>
                  </TableCell>
                  <TableCell>{getStatusBadge(entry)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.updatedBy || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.updatedAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/cms/pages/${entry.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`${process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"}/cms/pages/preview/${entry.id}`}
                            target="_blank"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
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
  );
}
