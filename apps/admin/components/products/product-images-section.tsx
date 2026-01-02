"use client";

import dynamic from "next/dynamic";
import type { ProductImage } from "@/lib/types/products";

const ImageManager = dynamic(
  () =>
    import("@/components/products/image-manager").then((mod) => ({
      default: mod.ImageManager,
    })),
  { loading: () => <div className="h-32 animate-pulse bg-muted rounded" /> },
);

interface ProductImagesSectionProps {
  productId: string;
  images: ProductImage[];
}

export function ProductImagesSection({
  productId,
  images,
}: ProductImagesSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload and manage product images
      </p>
      <ImageManager
        productId={productId}
        images={images}
        onImagesChange={() => {}}
      />
    </div>
  );
}
