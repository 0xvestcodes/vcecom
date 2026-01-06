"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddToCartButton } from "./add-to-cart-button";
import { VariantSelector } from "./variant-selector";

interface Variant {
  id: string;
  title: string | null;
  inventory: number;
  price?: number;
}

interface ProductFormProps {
  productId: string;
  variants: Variant[];
  inStock: boolean;
}

export function ProductForm({
  productId,
  variants,
  inStock,
}: ProductFormProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants[0]?.id || "",
  );

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {variants.length > 0 && (
            <VariantSelector
              variants={variants}
              productId={productId}
              onVariantChange={setSelectedVariantId}
            />
          )}
          <div className="flex items-center gap-4">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              defaultValue="1"
              className="w-20"
              disabled
            />
          </div>
          <AddToCartButton
            productId={productId}
            variantId={selectedVariantId || undefined}
            disabled={!inStock || (variants.length > 0 && !selectedVariantId)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
