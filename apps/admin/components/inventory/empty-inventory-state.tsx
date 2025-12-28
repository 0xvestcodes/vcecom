"use client";

import { Boxes } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Empty state component for inventory list when no items are found
 */
export function EmptyInventoryState() {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
      <Boxes className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">No inventory items found</p>
      <p className="text-xs mb-4">
        Try adjusting your filters or search terms to find what you're looking
        for.
      </p>
      <Button asChild size="sm" className="text-xs">
        <Link href="/inventory/bulk-adjust">Bulk Adjust Inventory</Link>
      </Button>
    </div>
  );
}
