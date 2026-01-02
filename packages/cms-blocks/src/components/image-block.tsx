"use client";

import { BlockImage } from "./shared";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface ImageBlockProps {
  src?: string;
  alt?: string;
  caption?: string;
}

export function ImageBlock({ props }: BlockComponentProps<ImageBlockProps>) {
  const { src, alt, caption, style } = props;

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
    "relative",
    variantClasses[style?.variant || "default"],
    style?.padding && paddingClasses[style.padding],
    style?.align && alignClasses[style.align],
  );

  return (
    <div className={blockClasses}>
      {src ? (
        <BlockImage
          src={src}
          alt={alt || ""}
          width={1200}
          height={675}
          className="w-full"
        />
      ) : null}
      {caption ? (
        <p className="text-sm text-muted-foreground mt-2 text-center">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
