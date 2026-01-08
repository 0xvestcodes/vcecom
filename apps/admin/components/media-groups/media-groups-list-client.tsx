"use client";

import { Edit, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { ProtectedButton } from "@/components/common/protected-button";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminDeleteMediaGroup } from "@/hooks/media-groups/use-admin-delete-media-group";
import { useAdminMediaGroups } from "@/hooks/media-groups/use-admin-media-groups";
import { usePagination } from "@/hooks/use-pagination";
import type {
  MediaGroup,
  MediaGroupQueryParams,
} from "@/lib/types/media-groups";
import { PaginationControls } from "../common/pagination-controls";
import { EmptyMediaGroupsState } from "./empty-media-groups-state";
import { MediaGroupSheet } from "./media-group-sheet";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;

function parseFiltersFromSearchParams(searchParams: URLSearchParams) {
  return {
    page: parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10),
    limit: parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    search: searchParams.get("search") || undefined,
    isActive:
      searchParams.get("isActive") === "true"
        ? true
        : searchParams.get("isActive") === "false"
          ? false
          : undefined,
  };
}

function useSyncFiltersToUrl(
  filters: MediaGroupQueryParams,
  router: ReturnType<typeof useRouter>,
) {
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.page && filters.page > 1)
      params.set("page", filters.page.toString());
    if (filters.limit && filters.limit !== DEFAULT_LIMIT)
      params.set("limit", filters.limit.toString());
    if (filters.search) params.set("search", filters.search);
    if (filters.isActive !== undefined)
      params.set("isActive", String(filters.isActive));

    router.replace(`/media-groups?${params.toString()}`, {
      scroll: false,
    });
  }, [filters, router]);
}

export function MediaGroupsListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mediaGroupSheetOpen, setMediaGroupSheetOpen] = useState(false);
  const [selectedMediaGroupId, setSelectedMediaGroupId] = useState<
    string | null
  >(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mediaGroupToDelete, setMediaGroupToDelete] = useState<string | null>(
    null,
  );

  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [filters, setFilters] = useState<MediaGroupQueryParams>(initialFilters);

  const {
    data: mediaGroupsData,
    isLoading,
    error,
  } = useAdminMediaGroups(filters);

  useSyncFiltersToUrl(filters, router);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const paginationData = mediaGroupsData
    ? {
        page: mediaGroupsData.pagination.page,
        limit: mediaGroupsData.pagination.limit,
        total: mediaGroupsData.pagination.total,
        totalPages: mediaGroupsData.pagination.totalPages,
        hasNextPage: mediaGroupsData.pagination.hasNextPage,
        hasPreviousPage: mediaGroupsData.pagination.hasPreviousPage,
      }
    : undefined;

  const pagination = usePagination(paginationData, handlePageChange);

  const deleteMediaGroup = useAdminDeleteMediaGroup();

  const handleCreate = () => {
    setSelectedMediaGroupId(null);
    setMediaGroupSheetOpen(true);
  };

  const handleEdit = (id: string) => {
    setSelectedMediaGroupId(id);
    setMediaGroupSheetOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setMediaGroupToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (mediaGroupToDelete) {
      try {
        await deleteMediaGroup.mutateAsync(mediaGroupToDelete);
        setDeleteDialogOpen(false);
        setMediaGroupToDelete(null);
      } catch (_error) {
        // Error handled by hook
      }
    }
  };

  const handleClearFilters = () => {
    setFilters({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
    });
  };

  const columns: Column<MediaGroup>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: "Name",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      id: "slug",
      accessorKey: "slug",
      header: "Slug",
      cell: (row) => (
        <span className="text-muted-foreground font-mono text-sm">
          {row.slug}
        </span>
      ),
    },
    {
      id: "imageCount",
      accessorKey: "imageCount",
      header: "Images",
      cell: (row) => (
        <span className="text-muted-foreground">{row.imageCount || 0}</span>
      ),
    },
    {
      id: "isActive",
      accessorKey: "isActive",
      header: "Status",
      cell: (row) => (
        <span
          className={`text-xs px-2 py-1 rounded ${
            row.isActive
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
          }`}
        >
          {row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "displayOrder",
      accessorKey: "displayOrder",
      header: "Order",
      cell: (row) => (
        <span className="text-muted-foreground">{row.displayOrder}</span>
      ),
    },
  ];

  const rowActions: RowAction<MediaGroup>[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (mediaGroup) => handleEdit(mediaGroup.id),
      roles: ["admin", "marketing"],
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (mediaGroup) => handleDeleteClick(mediaGroup.id),
      destructive: true,
      roles: ["admin", "marketing"],
    },
  ];

  return (
    <>
      <ListLayout
        title="Media Groups"
        description="Organize images into groups for banners, hero sections, and more"
        searchPlaceholder="Search media groups..."
        searchValue={filters.search || ""}
        onSearchChange={(value) =>
          setFilters((prev) => ({
            ...prev,
            search: value || undefined,
            page: DEFAULT_PAGE,
          }))
        }
        createButton={
          <ProtectedButton requiredRoles={["admin", "marketing"]}>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Media Group
            </Button>
          </ProtectedButton>
        }
        onClearFilters={handleClearFilters}
        pagination={
          <PaginationControls
            paginationInfo={pagination.paginationInfo}
            onPreviousPage={pagination.handlePreviousPage}
            onNextPage={pagination.handleNextPage}
            canGoPrevious={pagination.canGoPrevious}
            canGoNext={pagination.canGoNext}
            isLoading={isLoading}
            itemLabel="media groups"
          />
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={mediaGroupsData}
          loadingComponent={
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          }
          emptyComponent={<EmptyMediaGroupsState onCreate={handleCreate} />}
          onRetry={() => window.location.reload()}
        >
          <DataTable<MediaGroup>
            columns={columns}
            data={mediaGroupsData?.data || []}
            rowActions={rowActions}
            onRowClick={(mediaGroup) =>
              router.push(`/media-groups/${mediaGroup.id}`)
            }
            emptyMessage="No media groups found"
            isLoading={isLoading}
          />
        </QueryState>
      </ListLayout>

      <MediaGroupSheet
        mediaGroupId={selectedMediaGroupId}
        open={mediaGroupSheetOpen}
        onOpenChange={setMediaGroupSheetOpen}
        onClose={() => {
          setMediaGroupSheetOpen(false);
          setSelectedMediaGroupId(null);
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Media Group"
        description="Are you sure you want to delete this media group? All images in this group will also be deleted. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </>
  );
}
