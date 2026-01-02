"use client";

import { ProductCardBlock } from "./product-card-block";
import type { BlockComponentProps } from "./types";

interface CollectionShowcaseBlockProps {
  collectionId: string;
  title?: string;
  limit?: number;
}

export function CollectionShowcaseBlock({
  props,
  products,
  collections,
}: BlockComponentProps<CollectionShowcaseBlockProps>) {
  const { collectionId, title, limit = 4 } = props;
  const collection = collections?.[collectionId] as
    | {
        id: string;
        name?: string;
        productIds?: string[];
      }
    | undefined;

  if (!collection) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Collection not found
      </div>
    );
  }

  const productIds = (collection.productIds || []).slice(0, limit);

  return (
    <div>
      {title ? <h2 className="mb-4 text-2xl font-bold">{title}</h2> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {productIds.map((productId) => (
          <ProductCardBlock
            key={productId}
            props={{ productId, style: "detailed" }}
            products={products}
          />
        ))}
      </div>
    </div>
  );
}
