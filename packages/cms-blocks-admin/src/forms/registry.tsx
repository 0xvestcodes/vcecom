"use client";

import type { BlockType } from "@vcecom/cms-blocks";
import type { BlockFormComponent } from "../types";
import { HeroForm } from "./hero-form";
import { ImageForm } from "./image-form";
import { RichTextForm } from "./rich-text-form";

/**
 * Registry mapping block types to their form components
 * Add more forms as they are created
 */
export const blockFormRegistry: Partial<Record<BlockType, BlockFormComponent>> =
  {
    hero: HeroForm,
    rich_text: RichTextForm,
    image: ImageForm,
    // Add more forms as they are created:
    // video: VideoForm,
    // spacer: SpacerForm,
    // product_grid: ProductGridForm,
    // etc.
  };

/**
 * Get form component for a block type
 */
export function getBlockForm(type: BlockType): BlockFormComponent | null {
  return blockFormRegistry[type] || null;
}

/**
 * Check if a form exists for a block type
 */
export function hasBlockForm(type: BlockType): boolean {
  return type in blockFormRegistry;
}
