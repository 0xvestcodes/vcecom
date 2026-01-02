"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { EditorPanel } from "@/components/layout/editor-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminCategory } from "@/hooks/categories/use-admin-categories";
import { useAdminDeleteCategory } from "@/hooks/categories/use-admin-delete-category";
import { useAdminUpdateCategory } from "@/hooks/categories/use-admin-update-category";
import type { UpdateCategoryInput } from "@/lib/types/categories";
import { DateTime } from "../orders/date-time";
import { CategoryForm } from "./category-form";

interface CategoryEditorPanelProps {
  categoryId: string;
}

/**
 * Refactored Category Editor Panel using EditorPanel layout (L2 pattern)
 * Uses collapsible sections instead of tabs
 */
export function CategoryEditorPanel({ categoryId }: CategoryEditorPanelProps) {
  const router = useRouter();
  const { data: category, isLoading } = useAdminCategory(categoryId);
  const updateCategory = useAdminUpdateCategory(categoryId);
  const deleteCategory = useAdminDeleteCategory();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleSave = async (data: UpdateCategoryInput) => {
    try {
      await updateCategory.mutateAsync(data);
      toast.success("Category updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update category",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCategory.mutateAsync(categoryId);
      toast.success("Category deleted successfully");
      router.push("/products/categories");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete category",
      );
    }
  };

  if (isLoading) {
    return (
      <EditorPanel title="Loading..." backHref="/products/categories">
        <div className="space-y-4">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      </EditorPanel>
    );
  }

  if (!category) {
    return (
      <EditorPanel title="Category Not Found" backHref="/products/categories">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Category not found</p>
        </div>
      </EditorPanel>
    );
  }

  return (
    <>
      <EditorPanel
        title={category.name}
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: "Categories", href: "/products/categories" },
          { label: category.name },
        ]}
        onSave={undefined}
        isSaving={updateCategory.isPending}
        backHref="/products/categories"
        sidebar={
          <>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Slug</div>
                  <div className="font-medium">{category.slug}</div>
                </div>
                {category.parentId && (
                  <div>
                    <div className="text-sm text-muted-foreground">Parent</div>
                    <div className="font-medium">{category.parentId}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground">Products</div>
                  <div className="font-medium">
                    {category.productCount || 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <DateTime date={category.createdAt} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                  <DateTime date={category.updatedAt} />
                </div>
              </CardContent>
            </Card>
          </>
        }
        warningActions={
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Category
          </Button>
        }
      >
        {/* General Information Section */}
        <CollapsibleSection title="General Information" defaultOpen>
          <CategoryForm
            category={category}
            onSubmit={handleSave}
            isLoading={updateCategory.isPending}
          />
        </CollapsibleSection>
      </EditorPanel>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteCategory.isPending}
      />
    </>
  );
}
