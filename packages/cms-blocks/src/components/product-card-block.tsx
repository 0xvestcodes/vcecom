"use client";

import Link from "next/link";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface ProductCardBlockProps {
  productId: string;
  style?: "compact" | "detailed" | "featured";
}

export function ProductCardBlock({
  props,
  products,
}: BlockComponentProps<ProductCardBlockProps>) {
  const { productId, style = "detailed" } = props;
  const product = products?.[productId] as
    | {
        id: string;
        title?: string;
        description?: string;
        priceIncludingGst?: number;
        priceExcludingGst?: number;
        image?: string;
      }
    | undefined;

  if (!product) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Product not found
      </div>
    );
  }

  const isCompact = style === "compact";
  const isFeatured = style === "featured";

  return (
    <Link href={`/products/${product.id}`}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-lg",
          isFeatured && "border-2 border-primary",
        )}
      >
        <div
          className={cn(
            "relative bg-muted",
            isCompact ? "aspect-square" : "aspect-square",
          )}
        >
          {product.image ? (
            <img
              src={product.image}
              alt={product.title || "Product"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
        </div>
        <div className={cn("p-4", isCompact && "p-2")}>
          <h3
            className={cn(
              "font-semibold line-clamp-2",
              isCompact ? "text-sm mb-1" : "text-lg mb-2",
            )}
          >
            {product.title}
          </h3>
          {!isCompact && product.description && (
            <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
              {product.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p
                className={cn("font-bold", isCompact ? "text-lg" : "text-2xl")}
              >
                ₹{product.priceIncludingGst?.toFixed(2) || "0.00"}
              </p>
              {product.priceExcludingGst !== product.priceIncludingGst && (
                <p className="text-sm text-muted-foreground line-through">
                  ₹{product.priceExcludingGst?.toFixed(2) || "0.00"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
