"use client";

import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface EmbedBlockProps {
  url?: string;
  html?: string;
}

export function EmbedBlock({ props }: BlockComponentProps<EmbedBlockProps>) {
  const { url, html, style } = props;

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    "relative w-full",
    variantClasses[style?.variant || "default"],
  );

  if (html) {
    return (
      <div
        className={blockClasses}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (url) {
    return (
      <div className={blockClasses}>
        <iframe
          src={url}
          className="w-full h-[600px] rounded-lg"
          allowFullScreen
        />
      </div>
    );
  }

  return null;
}
