"use client";

import { ProductCardBlock } from "./product-card-block";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface ProductGridBlockProps {
  title?: string;
  productIds: string[];
  columns?: "2" | "3" | "4";
}

export function ProductGridBlock({
  props,
  products,
}: BlockComponentProps<ProductGridBlockProps>) {
  const { title, productIds, columns = "3" } = props;

  const gridCols = {
    "2": "md:grid-cols-2",
    "3": "md:grid-cols-3",
    "4": "md:grid-cols-4",
  } as const;

  const productList = productIds
    .map((id) => products?.[id])
    .filter(Boolean)
    .map((product) => ({
      id: (product as { id: string }).id,
    }));

  return (
    <div>
      {title ? <h2 className="mb-4 text-2xl font-bold">{title}</h2> : null}
      <div className={cn("grid grid-cols-1 gap-4", gridCols[columns])}>
        {productList.map((product) => (
          <ProductCardBlock
            key={product.id}
            props={{ productId: product.id, style: "detailed" }}
            products={products}
          />
        ))}
      </div>
    </div>
  );
}
