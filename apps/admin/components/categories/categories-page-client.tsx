"use client";

import { FolderTree, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminCategories } from "@/hooks/categories/use-admin-categories";
import { useAdminDeleteCategory } from "@/hooks/categories/use-admin-delete-category";
import type { CategoryQueryParams } from "@/lib/types/categories";
import { CategoriesFiltersBar } from "./categories-filters-bar";
import { CategoryCard } from "./category-card";
import { CategoryTreeView } from "./category-tree-view";

export function CategoriesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deleteCategory = useAdminDeleteCategory();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "tree">("grid");

  const [filters, setFilters] = useState<CategoryQueryParams>({
    search: searchParams.get("search") || undefined,
  });

  const {
    data: categories = [],
    isLoading,
    error,
  } = useAdminCategories(filters);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);

    router.replace(`/products/categories?${params.toString()}`, {
      scroll: false,
    });
  }, [filters, router]);

  const handleDeleteClick = (categoryId: string) => {
    setCategoryToDelete(categoryId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (categoryToDelete) {
      await deleteCategory.mutateAsync(categoryToDelete);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      search: undefined,
    });
  };

  if (isLoading) {
    return (
      <AdminPageLayout
        title="Categories"
        description="Manage product categories"
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
    toast.error(error.message || "Failed to load categories");
    return (
      <AdminPageLayout
        title="Categories"
        description="Manage product categories"
      >
        <div className="text-center py-8 text-destructive">
          Error loading categories: {error.message}
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <>
      <AdminPageLayout
        title="Categories"
        description="Manage product categories"
        actions={
          <Button asChild size="sm" className="text-xs">
            <Link href="/products/categories/create">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create Category
            </Link>
          </Button>
        }
        filters={
          <CategoriesFiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            onClear={handleClearFilters}
          />
        }
      >
        <Tabs
          value={viewMode}
          onValueChange={(value) => setViewMode(value as "grid" | "tree")}
          className="w-full"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="grid">Grid View</TabsTrigger>
            <TabsTrigger value="tree">Tree View</TabsTrigger>
          </TabsList>
          <TabsContent value="grid">
            {categories.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
                <FolderTree className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium mb-1">No categories found</p>
                <p className="text-xs mb-4">
                  {filters.search
                    ? "Try adjusting your search"
                    : "Create your first category to get started"}
                </p>
                {!filters.search && (
                  <Button asChild size="sm" className="text-xs">
                    <Link href="/products/categories/create">
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Create Category
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="tree">
            <CategoryTreeView
              categories={categories}
              onDelete={handleDeleteClick}
            />
          </TabsContent>
        </Tabs>
      </AdminPageLayout>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        description="Are you sure you want to delete this category? Products will remain but will be removed from this category."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
}
