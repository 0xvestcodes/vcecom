"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAdminCreateDiscount } from "@/hooks/discounts/use-admin-create-discount";
import { useAdminDiscount } from "@/hooks/discounts/use-admin-discount";
import { useAdminUpdateDiscount } from "@/hooks/discounts/use-admin-update-discount";
import type {
  CreateDiscountInput,
  UpdateDiscountInput,
} from "@/lib/types/discounts";
import { DiscountFormWizard } from "./discount-form-wizard";

interface DiscountSheetProps {
  discountId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Discount Sheet Component
 *
 * Create/Edit discounts via Sheet (not full page)
 * Opens from discounts list
 * Uses collapsible sections instead of wizard
 */
export function DiscountSheet({
  discountId,
  open,
  onOpenChange,
}: DiscountSheetProps) {
  const router = useRouter();
  const isEditMode = !!discountId;
  const { data: discount } = useAdminDiscount(
    discountId || "",
    isEditMode && open,
  );
  const createDiscount = useAdminCreateDiscount();
  const updateDiscount = useAdminUpdateDiscount(discountId || "");

  const handleSubmit = async (
    data: CreateDiscountInput | UpdateDiscountInput,
  ) => {
    try {
      if (isEditMode) {
        await updateDiscount.mutateAsync(data as UpdateDiscountInput);
      } else {
        const created = await createDiscount.mutateAsync(
          data as CreateDiscountInput,
        );
        // Optionally navigate to detail or just close
        onOpenChange(false);
      }
    } catch (error) {
      // Error handled by hooks
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? "Edit Discount" : "Create Discount"}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <div className="py-4">
            <DiscountFormWizard
              initialData={
                discount ? mapDiscountToFormData(discount) : undefined
              }
              onSubmit={handleSubmit}
              isLoading={
                isEditMode ? updateDiscount.isPending : createDiscount.isPending
              }
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Maps Discount to CreateDiscountInput format
 */
function mapDiscountToFormData(
  discount: NonNullable<ReturnType<typeof useAdminDiscount>["data"]>,
): Partial<CreateDiscountInput> {
  return {
    code: discount.code,
    name: discount.name,
    description: discount.description || undefined,
    type: discount.type,
    applicationType: discount.applicationType,
    valueType: discount.valueType,
    value: discount.value,
    minOrderAmount: discount.minOrderAmount || undefined,
    maxDiscountAmount: discount.maxDiscountAmount || undefined,
    minQuantity: discount.minQuantity || undefined,
    customerGroupIds: discount.customerGroupIds || undefined,
    scope: discount.scope,
    priority: discount.priority,
    canStack: discount.canStack,
    mutuallyExclusive: discount.mutuallyExclusive,
    startDate:
      discount.startDate instanceof Date
        ? discount.startDate.toISOString()
        : discount.startDate,
    endDate: discount.endDate
      ? discount.endDate instanceof Date
        ? discount.endDate.toISOString()
        : discount.endDate
      : undefined,
    isActive: discount.isActive,
    usageLimit: discount.usageLimit || undefined,
    perUserLimit: discount.perUserLimit || undefined,
    productIds: discount.productIds,
    categoryIds: discount.categoryIds,
    collectionIds: discount.collectionIds,
    tagIds: discount.tagIds,
    buyProductIds: discount.buyProductIds,
    buyCategoryIds: discount.buyCategoryIds,
    buyCollectionIds: discount.buyCollectionIds,
    buyTagIds: discount.buyTagIds,
    getProductIds: discount.getProductIds,
    getCategoryIds: discount.getCategoryIds,
    getCollectionIds: discount.getCollectionIds,
    getTagIds: discount.getTagIds,
    tieredRules: discount.tieredRules,
    excludedDiscountIds: discount.excludedDiscountIds,
  };
}
