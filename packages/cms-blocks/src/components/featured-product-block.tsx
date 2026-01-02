"use client";

import { ProductCardBlock } from "./product-card-block";
import type { BlockComponentProps } from "./types";

interface FeaturedProductBlockProps {
  productId: string;
}

export function FeaturedProductBlock({
  props,
  products,
}: BlockComponentProps<FeaturedProductBlockProps>) {
  return (
    <ProductCardBlock
      props={{ ...props, style: "featured" }}
      products={products}
    />
  );
}
