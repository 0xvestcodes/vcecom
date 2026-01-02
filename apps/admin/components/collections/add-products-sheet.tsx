"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAdminAddProductsToCollection } from "@/hooks/collections/use-admin-add-products-to-collection";
import { useAdminProducts } from "@/hooks/products/use-admin-products";

interface AddProductsSheetProps {
  collectionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProductIds: string[];
}

/**
 * Add Products Sheet Component (L3 pattern)
 *
 * Add products to collection via Sheet
 * Opens from collection editor
 */
export function AddProductsSheet({
  collectionId,
  open,
  onOpenChange,
}: AddProductsSheetProps) {
  const addProducts = useAdminAddProductsToCollection(collectionId);
  const [search, setSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set(),
  );

  const { data: productsData } = useAdminProducts({
    search,
    limit: 50,
  });

  const products = productsData?.data || [];

  const handleToggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedProductIds.size === 0) {
      toast.error("Please select at least one product");
      return;
    }

    try {
      await addProducts.mutateAsync({
        productIds: Array.from(selectedProductIds),
      });
      setSelectedProductIds(new Set());
      onOpenChange(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>Add Products to Collection</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Search Products</Label>
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center space-x-2 p-2 border rounded hover:bg-accent"
                >
                  <Checkbox
                    id={`product-${product.id}`}
                    checked={selectedProductIds.has(product.id)}
                    onCheckedChange={() => handleToggleProduct(product.id)}
                  />
                  <Label
                    htmlFor={`product-${product.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium">{product.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.status}
                    </div>
                  </Label>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={addProducts.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {addProducts.isPending
                  ? "Adding..."
                  : `Add ${selectedProductIds.size} Product${selectedProductIds.size !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
