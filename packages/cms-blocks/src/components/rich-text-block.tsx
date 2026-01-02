"use client";

import { BlockRichText } from "./shared";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface RichTextBlockProps {
  content?: unknown;
}

export function RichTextBlock({
  props,
}: BlockComponentProps<RichTextBlockProps>) {
  const { content, style } = props;

  if (!content) {
    return null;
  }

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const paddingClasses = {
    none: "",
    sm: "p-2",
    md: "p-4",
    lg: "p-6",
  } as const;

  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  } as const;

  const blockClasses = cn(
    "prose prose-lg max-w-none",
    variantClasses[style?.variant || "default"],
    style?.padding && paddingClasses[style.padding],
    style?.align && alignClasses[style.align],
  );

  return (
    <div className={blockClasses}>
      <BlockRichText content={content} />
    </div>
  );
}
