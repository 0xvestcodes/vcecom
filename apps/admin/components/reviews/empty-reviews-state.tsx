"use client";

import { Star } from "lucide-react";

export function EmptyReviewsState() {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
      <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">No reviews found</p>
      <p className="text-xs">
        All reviews have been moderated or there are no pending reviews
      </p>
    </div>
  );
}
