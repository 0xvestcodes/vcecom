"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CreateVariantForm } from "./variants/create-variant-form";

interface VariantSheetProps {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Variant Sheet Component
 *
 * Add/Edit variants via Sheet (not full page)
 * Opens from product editor
 * Inline form
 * No navigation away
 */
export function VariantSheet({
  productId,
  open,
  onOpenChange,
}: VariantSheetProps) {
  const _handleComplete = () => {
    onOpenChange(false);
    // Optionally refresh the page or update the variants list
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Add Variant</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <CreateVariantForm
            productId={productId}
            productTitle=""
            defaultPrice={0}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
