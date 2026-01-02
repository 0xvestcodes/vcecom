"use client";

import type { BlockType } from "@vcecom/cms-blocks";
import { BLOCK_REGISTRY } from "@vcecom/cms-blocks";

interface Block {
  id: string;
  type: string;
  props: Record<string, unknown>;
  order: number;
  style?: {
    variant?: "default" | "inset" | "card" | "section" | "ghost";
    padding?: "none" | "sm" | "md" | "lg";
    align?: "left" | "center" | "right";
  };
}

interface BlockPreviewProps {
  block: Block;
  products?: Record<string, unknown>;
  collections?: Record<string, unknown>;
}

/**
 * Block Preview Component
 * Uses the same BLOCK_REGISTRY as storefront to ensure preview matches output
 */
export function BlockPreview({
  block,
  products = {},
  collections = {},
}: BlockPreviewProps) {
  const Component = BLOCK_REGISTRY[block.type as BlockType];
  if (!Component) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Unknown block type: {block.type}
      </div>
    );
  }

  return (
    <Component
      props={{
        ...block.props,
        id: block.id,
        type: block.type,
        style: block.style,
      }}
      products={products}
      collections={collections}
    />
  );
}

interface BlocksPreviewProps {
  blocks: Block[];
  products?: Record<string, unknown>;
  collections?: Record<string, unknown>;
}

/**
 * Preview multiple blocks
 */
export function BlocksPreview({
  blocks,
  products = {},
  collections = {},
}: BlocksPreviewProps) {
  return (
    <div className="space-y-4">
      {blocks
        .sort((a, b) => a.order - b.order)
        .map((block) => (
          <BlockPreview
            key={block.id}
            block={block}
            products={products}
            collections={collections}
          />
        ))}
    </div>
  );
}
