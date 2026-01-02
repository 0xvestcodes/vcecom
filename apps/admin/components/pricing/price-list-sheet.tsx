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
import { useAdminCreatePriceList } from "@/hooks/pricing/use-admin-create-price-list";
import { useAdminPriceList } from "@/hooks/pricing/use-admin-price-list";
import { useAdminUpdatePriceList } from "@/hooks/pricing/use-admin-update-price-list";
import type {
  CreatePriceListInput,
  UpdatePriceListInput,
} from "@/lib/types/price-lists";

interface PriceListSheetProps {
  priceListId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Price List Sheet Component (L3 pattern)
 *
 * Create/Edit price lists via Sheet (not full page)
 * Opens from price lists list
 * Simple form with < 6 fields
 */
export function PriceListSheet({
  priceListId,
  open,
  onOpenChange,
}: PriceListSheetProps) {
  const router = useRouter();
  const isEditMode = !!priceListId;
  const { data: priceList } = useAdminPriceList(
    priceListId || "",
    !!(isEditMode && open),
  );
  const createPriceList = useAdminCreatePriceList();
  const updatePriceList = useAdminUpdatePriceList(priceListId || "");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePriceListInput | UpdatePriceListInput>({
    defaultValues: {
      isActive: true,
    },
  });

  // Reset form when price list data loads
  useEffect(() => {
    if (priceList && isEditMode) {
      reset({
        name: priceList.name,
        description: priceList.description || undefined,
        isActive: priceList.isActive,
      });
    }
  }, [priceList, isEditMode, reset]);

  const onSubmit = async (
    data: CreatePriceListInput | UpdatePriceListInput,
  ) => {
    try {
      if (isEditMode) {
        await updatePriceList.mutateAsync(data as UpdatePriceListInput);
      } else {
        const created = await createPriceList.mutateAsync(
          data as CreatePriceListInput,
        );
        onOpenChange(false);
        router.push(`/price-lists/${created.id}`);
      }
    } catch (_error) {
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
            {isEditMode ? "Edit Price List" : "Create Price List"}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register("name", { required: "Name is required" })}
                placeholder="Wholesale Prices"
                aria-invalid={errors.name ? "true" : "false"}
              />
              <FieldError error={errors.name?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Optional description"
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
                  isEditMode
                    ? updatePriceList.isPending
                    : createPriceList.isPending
                }
              >
                {isEditMode
                  ? updatePriceList.isPending
                    ? "Saving..."
                    : "Save Changes"
                  : createPriceList.isPending
                    ? "Creating..."
                    : "Create Price List"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
