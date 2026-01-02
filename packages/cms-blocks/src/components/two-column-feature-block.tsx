"use client";

import { BlockImage, BlockRichText } from "./shared";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface TwoColumnFeatureBlockProps {
  leftContent?: string;
  rightContent?: string;
  leftImage?: string;
  rightImage?: string;
}

export function TwoColumnFeatureBlock({
  props,
}: BlockComponentProps<TwoColumnFeatureBlockProps>) {
  const { leftContent, rightContent, leftImage, rightImage, style } = props;

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    "grid grid-cols-1 gap-8 md:grid-cols-2",
    variantClasses[style?.variant || "default"],
  );

  return (
    <div className={blockClasses}>
      <div>
        {leftImage && (
          <BlockImage
            src={leftImage}
            alt="Left feature"
            width={600}
            height={400}
            className="mb-4"
          />
        )}
        {leftContent && <BlockRichText content={leftContent} />}
      </div>
      <div>
        {rightImage && (
          <BlockImage
            src={rightImage}
            alt="Right feature"
            width={600}
            height={400}
            className="mb-4"
          />
        )}
        {rightContent && <BlockRichText content={rightContent} />}
      </div>
    </div>
  );
}
