"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAdminAddPriceListItem } from "@/hooks/pricing/use-admin-add-price-list-item";
import { PriceListOverrideType } from "@/lib/types/price-lists";

interface AddPriceListItemSheetProps {
  priceListId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Add Price List Item Sheet Component (L3 pattern)
 *
 * Add price overrides via Sheet
 * Opens from price list editor
 */
export function AddPriceListItemSheet({
  priceListId,
  open,
  onOpenChange,
}: AddPriceListItemSheetProps) {
  const addItem = useAdminAddPriceListItem(priceListId);
  const [overrideType, setOverrideType] =
    useState<PriceListOverrideType>("FIXED");
  const [overrideValue, setOverrideValue] = useState<string>("0");
  const [productVariantId, setProductVariantId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");

  const handleSubmit = async () => {
    if (!overrideValue || parseFloat(overrideValue) <= 0) {
      toast.error("Please enter a valid override value");
      return;
    }

    if (!productVariantId && !productId && !categoryId) {
      toast.error("Please select a product, variant, or category");
      return;
    }

    try {
      await addItem.mutateAsync({
        priceListId,
        productVariantId: productVariantId || undefined,
        productId: productId || undefined,
        categoryId: categoryId || undefined,
        overrideType,
        overrideValue: parseFloat(overrideValue),
      });
      // Reset form
      setOverrideType("FIXED");
      setOverrideValue("0");
      setProductVariantId("");
      setProductId("");
      setCategoryId("");
      onOpenChange(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>Add Price Override</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Override Type</Label>
              <Select
                value={overrideType}
                onValueChange={(value) =>
                  setOverrideType(value as PriceListOverrideType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Fixed Amount</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overrideValue">
                {overrideType === "FIXED"
                  ? "Override Value (₹)"
                  : "Override Value (%)"}
              </Label>
              <Input
                id="overrideValue"
                type="number"
                step="0.01"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                placeholder={overrideType === "FIXED" ? "0.00" : "0"}
              />
            </div>

            <div className="space-y-2">
              <Label>Apply To</Label>
              <Select
                value={
                  productVariantId
                    ? "variant"
                    : productId
                      ? "product"
                      : categoryId
                        ? "category"
                        : ""
                }
                onValueChange={(value) => {
                  setProductVariantId("");
                  setProductId("");
                  setCategoryId("");
                  // In a real implementation, you'd load products/variants/categories here
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="variant">Product Variant</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Product/variant/category selection UI would go here
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={addItem.isPending}>
                {addItem.isPending ? "Adding..." : "Add Override"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
