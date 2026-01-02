"use client";

import { ProductCardBlock } from "./product-card-block";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface ProductCarouselBlockProps {
  title?: string;
  productIds: string[];
}

export function ProductCarouselBlock({
  props,
  products,
}: BlockComponentProps<ProductCarouselBlockProps>) {
  const { title, productIds } = props;

  const productList = productIds
    .map((id) => products?.[id])
    .filter(Boolean)
    .map((product) => ({
      id: (product as { id: string }).id,
    }));

  return (
    <div>
      {title ? <h2 className="mb-4 text-2xl font-bold">{title}</h2> : null}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {productList.map((product) => (
          <div key={product.id} className="min-w-[280px] flex-shrink-0">
            <ProductCardBlock
              props={{ productId: product.id, style: "detailed" }}
              products={products}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
