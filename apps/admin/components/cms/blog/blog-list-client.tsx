"use client";

import { formatDistanceToNow } from "date-fns";
import { Edit, Eye, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PaginationControls } from "@/components/common/pagination-controls";
import { QueryState } from "@/components/common/query-state";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { ListEntriesQueryParams } from "@/lib/types/cms";

/**
 * Client component for blog list
 * Shows all blog posts with filtering
 */
export function BlogListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || "",
  );

  // Find "blog_post" or "blog" content type
  const { data: contentTypes } = useAdminContentTypes();
  const blogContentType = contentTypes?.find(
    (ct) =>
      ct.name === "blog_post" ||
      ct.name === "blog" ||
      ct.displayName.toLowerCase().includes("blog"),
  );
  const contentTypeId = blogContentType?.id || "";

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

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters((prev) => ({
        ...prev,
        search: debouncedSearch || undefined,
        page: 1,
      }));
    }
  }, [debouncedSearch, filters.search]);

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
    const newUrl = queryString ? `/cms/blog?${queryString}` : `/cms/blog`;
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

  const getBlogTitle = (entry: NonNullable<typeof entriesData>["data"][0]) => {
    return (
      (entry.data.title as string) ||
      (entry.data.name as string) ||
      "Untitled Post"
    );
  };

  const getBlogUrl = (entry: NonNullable<typeof entriesData>["data"][0]) => {
    if (entry.slug) {
      return `/blog/${entry.slug}`;
    }
    return entry.data.slug ? `/blog/${entry.data.slug}` : "#";
  };

  const getStatusBadge = (
    entry: NonNullable<typeof entriesData>["data"][0],
  ) => {
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
      <AdminPageLayout title="Blog" description="Manage blog posts">
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Blog content type not found. Please create a "blog_post" content
            type first.
          </p>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Blog"
      description="Manage your blog posts"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Blog" },
      ]}
      actions={
        <Button asChild>
          <Link href="/cms/blog/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Post
          </Link>
        </Button>
      }
      filters={
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filters.status || "all"}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                status:
                  value === "all"
                    ? undefined
                    : (value as "draft" | "published"),
                page: 1,
              }))
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
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
            itemLabel="posts"
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
            No blog posts found
          </div>
        }
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Author</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entriesData?.data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {getBlogTitle(entry)}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {getBlogUrl(entry)}
                    </code>
                  </TableCell>
                  <TableCell>{getStatusBadge(entry)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(entry.data.category as string) || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.createdBy || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/cms/blog/${entry.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`${process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"}/cms/blog/preview/${entry.id}`}
                          target="_blank"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
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
