"use client";

import { Edit, FolderTree, Plus, Trash2 } from "lucide-react";
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
import { useAdminCategories } from "@/hooks/categories/use-admin-categories";
import { useAdminDeleteCategory } from "@/hooks/categories/use-admin-delete-category";
import type { Category, CategoryQueryParams } from "@/lib/types/categories";
import { CategorySheet } from "./category-sheet";
import { EmptyCategoriesState } from "./empty-categories-state";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Refactored Categories List Client using universal components (L1 pattern)
 */
export function CategoriesListClientRefactored() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [filters, setFilters] = useState<CategoryQueryParams>(initialFilters);

  const {
    data: categories = [],
    isLoading,
    error,
  } = useAdminCategories(filters);

  const deleteCategory = useAdminDeleteCategory();

  useSyncFiltersToUrl(filters, router);

  const handleCreate = () => {
    setSelectedCategoryId(null);
    setCategorySheetOpen(true);
  };

  const handleEdit = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setCategorySheetOpen(true);
  };

  const handleDeleteClick = (categoryId: string) => {
    setCategoryToDelete(categoryId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (categoryToDelete) {
      try {
        await deleteCategory.mutateAsync(categoryToDelete);
        toast.success("Category deleted successfully");
        setDeleteDialogOpen(false);
        setCategoryToDelete(null);
      } catch (_error) {
        // Error handled by hook
      }
    }
  };

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: undefined,
    });
  }, []);

  // Convert categories to table format
  const columns: Column<Category>[] = [
    {
      id: "name",
      header: "Name",
      cell: (category) => (
        <div>
          <div className="font-medium">{category.name}</div>
          {category.slug && (
            <div className="text-xs text-muted-foreground">{category.slug}</div>
          )}
        </div>
      ),
    },
    {
      id: "parent",
      header: "Parent",
      cell: (category) => category.parentId || "-",
    },
    {
      id: "products",
      header: "Products",
      cell: (category) => category.productCount || 0,
    },
    {
      id: "status",
      header: "Status",
      cell: (category) => (
        <span className="text-xs">
          {category.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const rowActions: RowAction<Category>[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (category) => handleEdit(category.id),
      roles: ["admin", "marketing"],
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (category) => handleDeleteClick(category.id),
      destructive: true,
      roles: ["admin", "marketing"],
    },
  ];

  return (
    <>
      <ListLayout
        title="Categories"
        description="Manage product categories"
        searchPlaceholder="Search categories..."
        searchValue={filters.search || ""}
        onSearchChange={(value) =>
          setFilters((prev) => ({
            ...prev,
            search: value || undefined,
          }))
        }
        createButton={
          <ProtectedButton requiredRoles={["admin", "marketing"]}>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Category
            </Button>
          </ProtectedButton>
        }
        onClearFilters={handleClearFilters}
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={categories}
          loadingComponent={
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          }
          emptyComponent={<EmptyCategoriesState onCreate={handleCreate} />}
          onRetry={() => window.location.reload()}
        >
          <DataTable
            columns={columns}
            data={categories}
            rowActions={rowActions}
            onRowClick={(category) =>
              router.push(`/products/categories/${category.id}`)
            }
            emptyMessage="No categories found"
            isLoading={isLoading}
          />
        </QueryState>
      </ListLayout>

      <CategorySheet
        categoryId={selectedCategoryId}
        open={categorySheetOpen}
        onOpenChange={(open) => {
          setCategorySheetOpen(open);
          if (!open) {
            setSelectedCategoryId(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteCategory.isPending}
      />
    </>
  );
}

/**
 * Parses search parameters from URL into CategoryQueryParams
 */
function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): CategoryQueryParams {
  return {
    search: searchParams.get("search") || undefined,
  };
}

/**
 * Hook to sync category filters to URL when they change
 */
function useSyncFiltersToUrl(
  filters: CategoryQueryParams,
  router: ReturnType<typeof useRouter>,
) {
  useEffect(() => {
    const urlParams = new URLSearchParams();

    if (filters.search) urlParams.set("search", filters.search);

    router.replace(`/products/categories?${urlParams.toString()}`, {
      scroll: false,
    });
  }, [filters, router]);
}
