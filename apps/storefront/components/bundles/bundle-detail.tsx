"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBundle } from "@/hooks/use-bundles";
import { useAddToCart } from "@/hooks/use-cart";
import type { BundleSet } from "@/lib/validations/bundle";

interface BundleDetailProps {
  bundleId: string;
}

export function BundleDetail({ bundleId }: BundleDetailProps) {
  const { data: bundle, isLoading, error } = useBundle(bundleId);
  const addToCart = useAddToCart();

  // Track selections: { setId: [variantId1, variantId2, ...] }
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-muted h-96 rounded-lg" />
            <div>
              <div className="h-8 bg-muted rounded w-3/4 mb-4" />
              <div className="h-4 bg-muted rounded w-1/2 mb-8" />
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-muted rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-destructive mb-4">Bundle not found</p>
          <Link href="/bundles">
            <Button>Back to Bundles</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Initialize selections with empty arrays for each set
  if (Object.keys(selections).length === 0 && bundle.sets.length > 0) {
    const initialSelections: Record<string, string[]> = {};
    bundle.sets.forEach((set) => {
      initialSelections[set.id] = [];
    });
    setSelections(initialSelections);
  }

  const handleVariantToggle = (setId: string, variantId: string) => {
    const currentSelections = selections[setId] || [];
    const set = bundle.sets.find((s) => s.id === setId);
    if (!set) return;

    const isSelected = currentSelections.includes(variantId);
    let newSelections: string[];

    if (bundle.allowMixAndMatch) {
      // For mix & match, allow multiple selections
      if (isSelected) {
        newSelections = currentSelections.filter((id) => id !== variantId);
      } else {
        // Check max quantity constraint
        if (currentSelections.length >= set.maxQuantity) {
          return; // Can't add more
        }
        newSelections = [...currentSelections, variantId];
      }
    } else {
      // For non-mix & match, only one selection per set
      newSelections = isSelected ? [] : [variantId];
    }

    // Ensure min quantity constraint
    if (newSelections.length < set.minQuantity) {
      // Don't allow if below minimum
      return;
    }

    setSelections({
      ...selections,
      [setId]: newSelections,
    });
  };

  const isSelectionValid = () => {
    return bundle.sets.every((set) => {
      const setSelections = selections[set.id] || [];
      return (
        setSelections.length >= set.minQuantity &&
        setSelections.length <= set.maxQuantity
      );
    });
  };

  const handleAddToCart = () => {
    if (!isSelectionValid()) {
      return;
    }

    addToCart.mutate({
      type: "bundle",
      bundleId: bundle.id,
      selections,
      quantity,
    });
  };

  const totalSelected = Object.values(selections).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/bundles"
          className="text-muted-foreground hover:text-foreground"
        >
          ← Back to Bundles
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Bundle Image/Info */}
        <div className="relative aspect-square bg-muted rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📦</div>
            <div className="text-muted-foreground">Bundle</div>
          </div>
        </div>

        {/* Bundle Details */}
        <div>
          <h1 className="text-3xl font-bold mb-4">{bundle.title}</h1>
          {bundle.description && (
            <p className="text-muted-foreground mb-6">{bundle.description}</p>
          )}
          {bundle.allowMixAndMatch && (
            <div className="mb-6">
              <span className="px-3 py-1 text-sm bg-primary/10 text-primary rounded-full">
                Mix & Match Enabled
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bundle Sets */}
      <div className="space-y-6">
        {bundle.sets.map((set) => (
          <SetSelector
            key={set.id}
            set={set}
            bundle={bundle}
            selections={selections[set.id] || []}
            onToggle={(variantId) => handleVariantToggle(set.id, variantId)}
          />
        ))}
      </div>

      {/* Quantity and Add to Cart */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Complete Your Bundle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label htmlFor="quantity" className="text-sm font-medium">
              Quantity:
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                -
              </Button>
              <span className="w-12 text-center">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {isSelectionValid() ? (
              <span className="text-green-600">
                ✓ Bundle configuration complete ({totalSelected} items selected)
              </span>
            ) : (
              <span className="text-amber-600">
                Please select items from all sets to complete your bundle
              </span>
            )}
          </div>

          <Button
            onClick={handleAddToCart}
            disabled={!isSelectionValid() || addToCart.isPending}
            className="w-full"
            size="lg"
          >
            {addToCart.isPending ? "Adding to Cart..." : "Add Bundle to Cart"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface SetSelectorProps {
  set: BundleSet;
  bundle: { allowMixAndMatch: boolean };
  selections: string[];
  onToggle: (variantId: string) => void;
}

function SetSelector({ set, bundle, selections, onToggle }: SetSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{set.title}</CardTitle>
        {set.description && (
          <p className="text-sm text-muted-foreground">{set.description}</p>
        )}
        <div className="text-sm text-muted-foreground">
          Select{" "}
          {set.minQuantity === set.maxQuantity
            ? `exactly ${set.minQuantity}`
            : `${set.minQuantity}-${set.maxQuantity}`}{" "}
          {set.minQuantity === 1 ? "item" : "items"}
          {bundle.allowMixAndMatch && " (you can mix and match)"}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {set.items.map((item) => {
            const isSelected = selections.includes(item.variantId);
            const canSelect = selections.length < set.maxQuantity || isSelected;
            const mustKeep = isSelected && selections.length <= set.minQuantity;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (mustKeep) return; // Can't deselect if at minimum
                  if (!canSelect) return; // Can't select if at maximum
                  onToggle(item.variantId);
                }}
                disabled={mustKeep || (!canSelect && !isSelected)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-input hover:border-primary/50"
                } ${
                  mustKeep
                    ? "opacity-75 cursor-not-allowed"
                    : canSelect
                      ? "cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="aspect-square bg-muted rounded mb-2 flex items-center justify-center">
                  <span className="text-2xl">📦</span>
                </div>
                <div className="text-sm font-medium">
                  Variant {item.variantId.slice(0, 8)}
                </div>
                {isSelected && (
                  <div className="text-xs text-primary mt-1">✓ Selected</div>
                )}
              </button>
            );
          })}
        </div>
        {selections.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            {selections.length} of {set.maxQuantity} selected
          </div>
        )}
      </CardContent>
    </Card>
  );
}
