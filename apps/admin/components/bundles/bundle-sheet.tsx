"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAdminBundle } from "@/hooks/bundles/use-admin-bundle";
import { useAdminCreateBundle } from "@/hooks/bundles/use-admin-create-bundle";
import { useAdminUpdateBundle } from "@/hooks/bundles/use-admin-update-bundle";
import type { CreateBundleInput, UpdateBundleInput } from "@/lib/types/bundles";

interface BundleSheetProps {
  bundleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Bundle Sheet Component (L3 pattern)
 *
 * Create/Edit bundles via Sheet (not full page)
 * Opens from bundles list
 * Simple form with < 6 fields
 */
export function BundleSheet({
  bundleId,
  open,
  onOpenChange,
}: BundleSheetProps) {
  const router = useRouter();
  const isEditMode = !!bundleId;
  const { data: bundle } = useAdminBundle(
    bundleId || "",
    isEditMode && open ? true : false,
  );
  const createBundle = useAdminCreateBundle();
  const updateBundle = useAdminUpdateBundle(bundleId || "");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBundleInput | UpdateBundleInput>({
    defaultValues: {
      isActive: true,
      allowMixAndMatch: false,
    },
  });

  useEffect(() => {
    if (bundle && isEditMode) {
      reset({
        title: bundle.title,
        description: bundle.description || undefined,
        isActive: bundle.isActive,
        allowMixAndMatch: bundle.allowMixAndMatch,
      });
    }
  }, [bundle, isEditMode, reset]);

  const onSubmit = async (data: CreateBundleInput | UpdateBundleInput) => {
    try {
      if (isEditMode) {
        await updateBundle.mutateAsync(data as UpdateBundleInput);
        onOpenChange(false);
      } else {
        const created = await createBundle.mutateAsync(
          data as CreateBundleInput,
        );
        onOpenChange(false);
        router.push(`/bundles/${created.id}`);
      }
    } catch (error) {
      // Error handled by hooks
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? "Edit Bundle" : "Create Bundle"}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                {...register("title", { required: "Title is required" })}
                placeholder="Bundle title"
                aria-invalid={errors.title ? "true" : "false"}
              />
              <FieldError error={errors.title?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Bundle description"
                rows={3}
                aria-invalid={errors.description ? "true" : "false"}
              />
              <FieldError error={errors.description?.message} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isEditMode ? updateBundle.isPending : createBundle.isPending
                }
              >
                {isEditMode
                  ? updateBundle.isPending
                    ? "Saving..."
                    : "Save Changes"
                  : createBundle.isPending
                    ? "Creating..."
                    : "Create Bundle"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
