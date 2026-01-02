"use client";

import { BlockImage, BlockRichText } from "./shared";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface ThreeColumnFeatureBlockProps {
  column1Content?: string;
  column2Content?: string;
  column3Content?: string;
  column1Image?: string;
  column2Image?: string;
  column3Image?: string;
}

export function ThreeColumnFeatureBlock({
  props,
}: BlockComponentProps<ThreeColumnFeatureBlockProps>) {
  const {
    column1Content,
    column2Content,
    column3Content,
    column1Image,
    column2Image,
    column3Image,
    style,
  } = props;

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    "grid grid-cols-1 gap-8 md:grid-cols-3",
    variantClasses[style?.variant || "default"],
  );

  return (
    <div className={blockClasses}>
      <div>
        {column1Image && (
          <BlockImage
            src={column1Image}
            alt="Column 1"
            width={400}
            height={300}
            className="mb-4"
          />
        )}
        {column1Content && <BlockRichText content={column1Content} />}
      </div>
      <div>
        {column2Image && (
          <BlockImage
            src={column2Image}
            alt="Column 2"
            width={400}
            height={300}
            className="mb-4"
          />
        )}
        {column2Content && <BlockRichText content={column2Content} />}
      </div>
      <div>
        {column3Image && (
          <BlockImage
            src={column3Image}
            alt="Column 3"
            width={400}
            height={300}
            className="mb-4"
          />
        )}
        {column3Content && <BlockRichText content={column3Content} />}
      </div>
    </div>
  );
}
