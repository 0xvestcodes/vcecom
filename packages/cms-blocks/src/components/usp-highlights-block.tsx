"use client";

import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface UspHighlightsBlockProps {
  items: Array<{
    icon?: string;
    title: string;
    description?: string;
  }>;
}

export function UspHighlightsBlock({
  props,
}: BlockComponentProps<UspHighlightsBlockProps>) {
  const { items, style } = props;

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4",
    variantClasses[style?.variant || "default"],
  );

  return (
    <div className={blockClasses}>
      {items.map((item) => (
        <div
          key={item.title || `usp-${item.icon || "item"}`}
          className="flex flex-col items-center space-y-2 text-center"
        >
          {item.icon ? <div className="mb-2 text-4xl">{item.icon}</div> : null}
          {item.title ? (
            <h3 className="text-lg font-semibold">{item.title}</h3>
          ) : null}
          {item.description ? (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
