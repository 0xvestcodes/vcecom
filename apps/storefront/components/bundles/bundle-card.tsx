"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { Bundle } from "@/lib/validations/bundle";

interface BundleCardProps {
  bundle: Bundle;
}

export function BundleCard({ bundle }: BundleCardProps) {
  const totalSets = bundle.sets.length;
  const totalItems = bundle.sets.reduce(
    (sum, set) => sum + set.items.length,
    0,
  );

  return (
    <Link href={`/bundles/${bundle.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative aspect-square bg-muted">
          {/* Placeholder for bundle image */}
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl mb-2">📦</div>
              <div className="text-sm">Bundle</div>
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-lg line-clamp-2 flex-1">
              {bundle.title}
            </h3>
            {bundle.allowMixAndMatch && (
              <span className="ml-2 px-2 py-1 text-xs bg-primary/10 text-primary rounded">
                Mix & Match
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {bundle.description ||
              "Customize your bundle with multiple choices"}
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {totalSets} {totalSets === 1 ? "set" : "sets"}
            </span>
            <span>•</span>
            <span>
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </span>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          <Button className="w-full" variant="outline">
            Customize Bundle
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
