"use client";

import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Variant } from "@/lib/types/products";
import { VariantSheet } from "./variant-sheet";

const VariantTable = dynamic(
  () =>
    import("@/components/products/variant-table").then((mod) => ({
      default: mod.VariantTable,
    })),
  { loading: () => <div className="h-64 animate-pulse bg-muted rounded" /> },
);

interface ProductVariantsSectionProps {
  productId: string;
  variants: Variant[];
}

export function ProductVariantsSection({
  productId,
  variants,
}: ProductVariantsSectionProps) {
  const [variantSheetOpen, setVariantSheetOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage product variants and their properties
        </p>
        <Button onClick={() => setVariantSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Variant
        </Button>
      </div>
      <VariantTable
        variants={variants}
        productId={productId}
        onDelete={() => {}}
      />
      <VariantSheet
        productId={productId}
        open={variantSheetOpen}
        onOpenChange={setVariantSheetOpen}
      />
    </div>
  );
}
