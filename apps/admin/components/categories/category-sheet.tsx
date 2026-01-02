"use client";

import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAdminCategory } from "@/hooks/categories/use-admin-categories";
import { useAdminCreateCategory } from "@/hooks/categories/use-admin-create-category";
import { useAdminUpdateCategory } from "@/hooks/categories/use-admin-update-category";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/lib/types/categories";
import { CategoryForm } from "./category-form";

interface CategorySheetProps {
  categoryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Category Sheet Component (L3 pattern)
 *
 * Create/Edit categories via Sheet (not full page)
 * Opens from categories list
 */
export function CategorySheet({
  categoryId,
  open,
  onOpenChange,
}: CategorySheetProps) {
  const router = useRouter();
  const isEditMode = !!categoryId;
  const { data: category } = useAdminCategory(categoryId || "");
  const createCategory = useAdminCreateCategory();
  const updateCategory = useAdminUpdateCategory(categoryId || "");

  const handleSubmit = async (
    data: CreateCategoryInput | UpdateCategoryInput,
  ) => {
    try {
      if (isEditMode) {
        await updateCategory.mutateAsync(data as UpdateCategoryInput);
        onOpenChange(false);
      } else {
        const created = await createCategory.mutateAsync(
          data as CreateCategoryInput,
        );
        onOpenChange(false);
        router.push(`/products/categories/${created.id}`);
      }
    } catch (_error) {
      // Error handled by hooks
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? "Edit Category" : "Create Category"}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <div className="py-4">
            <CategoryForm
              category={category}
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              isLoading={
                isEditMode ? updateCategory.isPending : createCategory.isPending
              }
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
