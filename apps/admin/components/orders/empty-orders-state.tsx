"use client";

import { ShoppingCart } from "lucide-react";

/**
 * Empty state component shown when no orders are found
 */
export function EmptyOrdersState() {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
      <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">No orders found</p>
      <p className="text-xs">
        Orders will appear here once customers start placing them
      </p>
    </div>
  );
}
