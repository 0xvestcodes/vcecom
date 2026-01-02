"use client";

import { Edit, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { useAdminCollections } from "@/hooks/collections/use-admin-collections";
import { useAdminDeleteCollection } from "@/hooks/collections/use-admin-delete-collection";
import { usePagination } from "@/hooks/use-pagination";
import type {
  Collection,
  CollectionQueryParams,
} from "@/lib/types/collections";
import { PaginationControls } from "../common/pagination-controls";
import { CollectionSheet } from "./collection-sheet";
import { EmptyCollectionsState } from "./empty-collections-state";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;

/**
 * Refactored Collections List Client using universal components (L1 pattern)
 */
export function CollectionsListClientRefactored() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [collectionSheetOpen, setCollectionSheetOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null
  >(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(
    null,
  );

  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [filters, setFilters] = useState<CollectionQueryParams>(initialFilters);

  const {
    data: collectionsData,
    isLoading,
    error,
  } = useAdminCollections(filters);

  useSyncFiltersToUrl(filters, router);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const paginationData = collectionsData
    ? {
        page: collectionsData.pagination.page,
        limit: collectionsData.pagination.limit,
        total: collectionsData.pagination.total,
        totalPages: collectionsData.pagination.totalPages,
        hasNextPage: collectionsData.pagination.hasNextPage,
        hasPreviousPage: collectionsData.pagination.hasPreviousPage,
      }
    : undefined;

  const pagination = usePagination(paginationData, handlePageChange);

  const deleteCollection = useAdminDeleteCollection();

  const handleCreate = () => {
    setSelectedCollectionId(null);
    setCollectionSheetOpen(true);
  };

  const handleEdit = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    setCollectionSheetOpen(true);
  };

  const handleDeleteClick = (collectionId: string) => {
    setCollectionToDelete(collectionId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (collectionToDelete) {
      try {
        await deleteCollection.mutateAsync(collectionToDelete);
        toast.success("Collection deleted successfully");
        setDeleteDialogOpen(false);
        setCollectionToDelete(null);
      } catch (_error) {
        // Error handled by hook
      }
    }
  };

  const handleClearFilters = useCallback(() => {
    setFilters({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
    });
  }, []);

  // Convert collections to table format
  const columns: Column<Collection>[] = [
    {
      id: "name",
      header: "Name",
      cell: (collection) => (
        <div>
          <div className="font-medium">{collection.name}</div>
          {collection.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {collection.description}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "products",
      header: "Products",
      cell: (collection) => collection.productCount || 0,
    },
    {
      id: "status",
      header: "Status",
      cell: (collection) => (
        <span className="text-xs">
          {collection.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const rowActions: RowAction<Collection>[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (collection) => handleEdit(collection.id),
      roles: ["admin", "marketing"],
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (collection) => handleDeleteClick(collection.id),
      destructive: true,
      roles: ["admin", "marketing"],
    },
  ];

  return (
    <>
      <ListLayout
        title="Collections"
        description="Manage product collections"
        searchPlaceholder="Search collections..."
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
              Create Collection
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
            itemLabel="collections"
          />
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={collectionsData}
          loadingComponent={
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          }
          emptyComponent={<EmptyCollectionsState onCreate={handleCreate} />}
          onRetry={() => window.location.reload()}
        >
          <DataTable<Collection>
            columns={columns}
            data={collectionsData?.data || []}
            rowActions={rowActions}
            onRowClick={(collection) =>
              router.push(`/products/collections/${collection.id}`)
            }
            emptyMessage="No collections found"
            isLoading={isLoading}
          />
        </QueryState>
      </ListLayout>

      <CollectionSheet
        collectionId={selectedCollectionId}
        open={collectionSheetOpen}
        onOpenChange={(open) => {
          setCollectionSheetOpen(open);
          if (!open) {
            setSelectedCollectionId(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Collection"
        description="Are you sure you want to delete this collection? Products will remain but will be removed from this collection."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteCollection.isPending}
      />
    </>
  );
}

/**
 * Parses search parameters from URL into CollectionQueryParams
 */
function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): CollectionQueryParams {
  return {
    page: parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10),
    limit: parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    search: searchParams.get("search") || undefined,
  };
}

/**
 * Hook to sync collection filters to URL when they change
 */
function useSyncFiltersToUrl(
  filters: CollectionQueryParams,
  router: ReturnType<typeof useRouter>,
) {
  useEffect(() => {
    const urlParams = new URLSearchParams();

    if (filters.page && filters.page > DEFAULT_PAGE) {
      urlParams.set("page", filters.page.toString());
    }
    if (filters.limit && filters.limit !== DEFAULT_LIMIT) {
      urlParams.set("limit", filters.limit.toString());
    }
    if (filters.search) urlParams.set("search", filters.search);

    router.replace(`/products/collections?${urlParams.toString()}`, {
      scroll: false,
    });
  }, [filters, router]);
}
