"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PaginationControls } from "@/components/common/pagination-controls";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { useAdminCollections } from "@/hooks/collections/use-admin-collections";
import { useAdminDeleteCollection } from "@/hooks/collections/use-admin-delete-collection";
import type { CollectionQueryParams } from "@/lib/types/collections";
import { CollectionCard } from "./collection-card";
import { CollectionsFiltersBar } from "./collections-filters-bar";

export function CollectionsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deleteCollection = useAdminDeleteCollection();

  const [filters, setFilters] = useState<CollectionQueryParams>({
    page: parseInt(searchParams.get("page") || "1", 10),
    limit: parseInt(searchParams.get("limit") || "12", 10),
    search: searchParams.get("search") || undefined,
  });

  const { data, isLoading, error } = useAdminCollections(filters);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.page && filters.page > 1)
      params.set("page", filters.page.toString());
    if (filters.limit && filters.limit !== 12)
      params.set("limit", filters.limit.toString());
    if (filters.search) params.set("search", filters.search);

    router.replace(`/products/collections?${params.toString()}`, {
      scroll: false,
    });
  }, [filters, router]);

  const handleDelete = async (collectionId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this collection? Products will remain but will be removed from this collection.",
      )
    ) {
      await deleteCollection.mutateAsync(collectionId);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      page: 1,
      limit: 12,
    });
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <AdminPageLayout
        title="Collections"
        description="Manage product collections"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={`skeleton-card-${String(i)}`}
              className="h-64 bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      </AdminPageLayout>
    );
  }

  if (error) {
    toast.error(error.message || "Failed to load collections");
    return (
      <AdminPageLayout
        title="Collections"
        description="Manage product collections"
      >
        <div className="text-center py-8 text-destructive">
          Error loading collections: {error.message}
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Collections"
      description="Manage product collections"
      actions={
        <Button asChild>
          <Link href="/products/collections/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Collection
          </Link>
        </Button>
      }
      filters={
        <CollectionsFiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          onClear={handleClearFilters}
        />
      }
      pagination={
        data ? (
          <PaginationControls
            paginationInfo={{
              startItem: (data.pagination.page - 1) * data.pagination.limit + 1,
              endItem: Math.min(
                data.pagination.page * data.pagination.limit,
                data.pagination.total,
              ),
              total: data.pagination.total,
              currentPage: data.pagination.page,
              totalPages: data.pagination.totalPages,
            }}
            onPreviousPage={() => handlePageChange(data.pagination.page - 1)}
            onNextPage={() => handlePageChange(data.pagination.page + 1)}
            canGoPrevious={data.pagination.hasPreviousPage}
            canGoNext={data.pagination.hasNextPage}
            isLoading={isLoading}
            itemLabel="collections"
          />
        ) : null
      }
    >
      {data && data.data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.data.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-lg font-medium mb-2">No collections found</p>
          <p className="text-sm text-muted-foreground mb-4">
            {filters.search
              ? "Try adjusting your search"
              : "Create your first collection to get started"}
          </p>
          {!filters.search && (
            <Button asChild>
              <Link href="/products/collections/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Collection
              </Link>
            </Button>
          )}
        </div>
      )}
    </AdminPageLayout>
  );
}
