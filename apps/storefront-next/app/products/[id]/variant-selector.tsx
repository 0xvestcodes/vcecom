"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/lib/contexts/currency-context";
import { formatCurrency } from "@/lib/utils";

interface Variant {
  id: string;
  title: string | null;
  inventory: number;
  price?: number;
}

interface VariantSelectorProps {
  variants: Variant[];
  productId: string;
  onVariantChange?: (variantId: string) => void;
}

export function VariantSelector({
  variants,
  onVariantChange,
}: VariantSelectorProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants[0]?.id || "",
  );

  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId);
    onVariantChange?.(variantId);
  };
  const { selectedCurrency } = useCurrency();

  if (variants.length === 0) return null;

  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) || variants[0];
  const isOutOfStock = selectedVariant.inventory <= 0;

  return (
    <div className="space-y-2">
      <Label htmlFor="variant">Variant</Label>
      <Select value={selectedVariantId} onValueChange={handleVariantChange}>
        <SelectTrigger id="variant">
          <SelectValue placeholder="Select a variant" />
        </SelectTrigger>
        <SelectContent>
          {variants.map((variant) => (
            <SelectItem key={variant.id} value={variant.id}>
              {variant.title || "Default"}{" "}
              {variant.inventory > 0 ? "" : "(Out of Stock)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedVariant && (
        <div className="flex items-center gap-2">
          {isOutOfStock ? (
            <Badge variant="destructive">Out of Stock</Badge>
          ) : (
            <Badge>In Stock ({selectedVariant.inventory} available)</Badge>
          )}
          {selectedVariant.price && (
            <span className="text-sm text-muted-foreground">
              Price: {formatCurrency(selectedVariant.price, selectedCurrency)}
            </span>
          )}
        </div>
      )}
      <input type="hidden" name="variantId" value={selectedVariantId} />
    </div>
  );
}
