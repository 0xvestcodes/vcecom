"use client";

import type { BlockComponentProps } from "./types";

interface SpacerBlockProps {
  height?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function SpacerBlock({ props }: BlockComponentProps<SpacerBlockProps>) {
  const { height = "md" } = props;

  const heightClasses = {
    xs: "h-4",
    sm: "h-8",
    md: "h-16",
    lg: "h-24",
    xl: "h-32",
  } as const;

  return <div className={heightClasses[height]} />;
}
