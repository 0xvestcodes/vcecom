"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAddToCart } from "@/hooks/use-cart";
import { useProduct, useProductVariants } from "@/hooks/use-products";

interface ProductDetailProps {
  productId: string;
}

export function ProductDetail({ productId }: ProductDetailProps) {
  const { data: product, isLoading, error } = useProduct(productId);
  const { data: variants } = useProductVariants(productId);
  const addToCart = useAddToCart();
  const variantSelectorId = useId();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants?.[0]?.id || null,
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-muted h-96 rounded-lg" />
            <div>
              <div className="h-8 bg-muted rounded w-3/4 mb-4" />
              <div className="h-4 bg-muted rounded w-1/2 mb-8" />
              <div className="h-10 bg-muted rounded w-full mb-4" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-destructive mb-4">Product not found</p>
          <Button
            onClick={() => {
              window.location.href = "/products";
            }}
          >
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  const selectedVariant =
    variants?.find((v) => v.id === selectedVariantId) || variants?.[0];

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    addToCart.mutate({
      productVariantId: selectedVariant.id,
      quantity: 1,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="relative aspect-square bg-muted rounded-lg flex items-center justify-center">
          <span className="text-muted-foreground">No Image</span>
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-3xl font-bold mb-4">{product.title}</h1>
          <div className="mb-6">
            <p className="text-3xl font-bold mb-2">
              ₹{product.priceIncludingGst.toFixed(2)}
            </p>
            {product.priceExcludingGst !== product.priceIncludingGst && (
              <p className="text-lg text-muted-foreground line-through">
                ₹{product.priceExcludingGst.toFixed(2)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              GST: {product.gstRate}% ({product.pricingType})
            </p>
          </div>

          {/* Variant Selector */}
          {variants && variants.length > 1 && (
            <div className="mb-6">
              <label
                htmlFor={variantSelectorId}
                className="block text-sm font-medium mb-2"
              >
                Select Variant
              </label>
              <div id={variantSelectorId} className="flex flex-wrap gap-2">
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`px-4 py-2 border rounded-md ${
                      selectedVariantId === variant.id
                        ? "border-primary bg-primary/10"
                        : "border-input"
                    }`}
                  >
                    {variant.size ||
                      variant.color ||
                      variant.sku ||
                      `Variant ${variant.id.slice(0, 8)}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock Status */}
          {selectedVariant && (
            <div className="mb-6">
              {selectedVariant.inventory === 0 ? (
                <p className="text-sm text-red-600 font-medium">Out of Stock</p>
              ) : selectedVariant.inventory <= 10 ? (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                    ⚠️ Low Stock - Only {selectedVariant.inventory} available!
                    Complete checkout quickly.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-green-600">
                  In Stock ({selectedVariant.inventory} available)
                </p>
              )}
            </div>
          )}

          {/* Add to Cart Button */}
          <Button
            onClick={handleAddToCart}
            disabled={
              !selectedVariant ||
              selectedVariant.inventory === 0 ||
              addToCart.isPending
            }
            className="w-full mb-6"
            size="lg"
          >
            {addToCart.isPending
              ? "Adding..."
              : selectedVariant?.inventory === 0
                ? "Out of Stock"
                : "Add to Cart"}
          </Button>

          {/* Description */}
          {product.description && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Description</h2>
                <p className="text-muted-foreground whitespace-pre-line">
                  {product.description}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
