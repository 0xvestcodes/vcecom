"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * VisuallyHidden component for screen reader accessibility
 * Hides content visually but keeps it accessible to screen readers
 */
export const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => {
  return <span ref={ref} className={cn("sr-only", className)} {...props} />;
});
VisuallyHidden.displayName = "VisuallyHidden";
