/**
 * CMS Block Types and Definitions
 */
export type BlockType =
  // Core
  | "rich_text"
  | "image"
  | "video"
  | "spacer"
  // Marketing
  | "hero"
  | "two_column_feature"
  | "three_column_feature"
  | "testimonials"
  | "testimonial_card"
  | "faq"
  | "newsletter"
  | "countdown_timer"
  | "social_proof"
  | "stats"
  // Commerce
  | "product_grid"
  | "product_carousel"
  | "product_card"
  | "collection_showcase"
  | "collection_card"
  | "category_navigation"
  | "category_card"
  | "featured_product"
  | "bundle_card"
  | "usp_highlights"
  | "comparison_table"
  // Social Media
  | "instagram_feed"
  | "social_feed"
  // Media
  | "image_gallery"
  | "video_gallery"
  | "before_after"
  // Content
  | "blog_post_card"
  | "timeline"
  | "pricing_table"
  // Layout
  | "tabs"
  | "accordion"
  // Utility
  | "contact_form"
  | "embed"
  | "announcement_bar"
  | "map_location";

export type BlockCategory = "core" | "marketing" | "commerce" | "utility";

export type BlockStyleVariant =
  | "default"
  | "inset"
  | "card"
  | "section"
  | "ghost";
export type BlockPadding = "none" | "sm" | "md" | "lg";
export type BlockAlign = "left" | "center" | "right";

export interface BlockStyle {
  variant?: BlockStyleVariant;
  padding?: BlockPadding;
  align?: BlockAlign;
}

export interface Block {
  id: string;
  type: BlockType;
  order: number;
  props: Record<string, unknown>;
  style?: BlockStyle;
}

export interface BlockDefinition {
  type: BlockType;
  displayName: string;
  description: string;
  category: BlockCategory;
  propsSchema: import("zod").ZodSchema;
  defaultProps: Record<string, unknown>;
}
