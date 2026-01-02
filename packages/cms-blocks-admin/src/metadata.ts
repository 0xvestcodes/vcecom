import type { BlockCategory, BlockType } from "@vcecom/cms-blocks";
import type { BlockMetadata } from "./types";

/**
 * Block metadata registry
 * Maps block types to their admin UI metadata
 */
export const blockMetadata: Record<BlockType, BlockMetadata> = {
  // Core
  rich_text: {
    type: "rich_text",
    displayName: "Rich Text",
    description: "Rich text content with formatting",
    category: "core",
    icon: "FileText",
  },
  image: {
    type: "image",
    displayName: "Image",
    description: "Single image with optional caption",
    category: "core",
    icon: "Image",
  },
  video: {
    type: "video",
    displayName: "Video",
    description: "Embedded video content",
    category: "core",
    icon: "Video",
  },
  spacer: {
    type: "spacer",
    displayName: "Spacer",
    description: "Vertical spacing element",
    category: "core",
    icon: "Minus",
  },
  // Marketing
  hero: {
    type: "hero",
    displayName: "Hero Banner",
    description: "Large banner with title, subtitle, and CTA",
    category: "marketing",
    icon: "Zap",
  },
  two_column_feature: {
    type: "two_column_feature",
    displayName: "Two Column Feature",
    description: "Two-column layout with content",
    category: "marketing",
    icon: "Columns",
  },
  three_column_feature: {
    type: "three_column_feature",
    displayName: "Three Column Feature",
    description: "Three-column layout with content",
    category: "marketing",
    icon: "Columns",
  },
  testimonials: {
    type: "testimonials",
    displayName: "Testimonials",
    description: "Customer testimonials carousel",
    category: "marketing",
    icon: "MessageSquare",
  },
  testimonial_card: {
    type: "testimonial_card",
    displayName: "Testimonial Card",
    description: "Single testimonial card",
    category: "marketing",
    icon: "MessageSquare",
  },
  faq: {
    type: "faq",
    displayName: "FAQ",
    description: "Frequently asked questions",
    category: "marketing",
    icon: "HelpCircle",
  },
  newsletter: {
    type: "newsletter",
    displayName: "Newsletter Signup",
    description: "Email newsletter subscription form",
    category: "marketing",
    icon: "Mail",
  },
  countdown_timer: {
    type: "countdown_timer",
    displayName: "Countdown Timer",
    description: "Countdown timer for promotions",
    category: "marketing",
    icon: "Clock",
  },
  social_proof: {
    type: "social_proof",
    displayName: "Social Proof",
    description: "Social proof indicators",
    category: "marketing",
    icon: "Users",
  },
  stats: {
    type: "stats",
    displayName: "Stats",
    description: "Statistics display",
    category: "marketing",
    icon: "BarChart",
  },
  // Commerce
  product_grid: {
    type: "product_grid",
    displayName: "Product Grid",
    description: "Grid of products",
    category: "commerce",
    icon: "Grid",
  },
  product_carousel: {
    type: "product_carousel",
    displayName: "Product Carousel",
    description: "Carousel of products",
    category: "commerce",
    icon: "ArrowRight",
  },
  product_card: {
    type: "product_card",
    displayName: "Product Card",
    description: "Single product card",
    category: "commerce",
    icon: "Package",
  },
  collection_showcase: {
    type: "collection_showcase",
    displayName: "Collection Showcase",
    description: "Showcase collections",
    category: "commerce",
    icon: "Folder",
  },
  collection_card: {
    type: "collection_card",
    displayName: "Collection Card",
    description: "Single collection card",
    category: "commerce",
    icon: "Folder",
  },
  category_navigation: {
    type: "category_navigation",
    displayName: "Category Navigation",
    description: "Category navigation menu",
    category: "commerce",
    icon: "Menu",
  },
  category_card: {
    type: "category_card",
    displayName: "Category Card",
    description: "Single category card",
    category: "commerce",
    icon: "Tag",
  },
  featured_product: {
    type: "featured_product",
    displayName: "Featured Product",
    description: "Featured product display",
    category: "commerce",
    icon: "Star",
  },
  bundle_card: {
    type: "bundle_card",
    displayName: "Bundle Card",
    description: "Product bundle card",
    category: "commerce",
    icon: "Box",
  },
  usp_highlights: {
    type: "usp_highlights",
    displayName: "USP Highlights",
    description: "Unique selling points",
    category: "commerce",
    icon: "CheckCircle",
  },
  comparison_table: {
    type: "comparison_table",
    displayName: "Comparison Table",
    description: "Product comparison table",
    category: "commerce",
    icon: "Table",
  },
  // Social Media
  instagram_feed: {
    type: "instagram_feed",
    displayName: "Instagram Feed",
    description: "Instagram feed integration",
    category: "marketing",
    icon: "Instagram",
  },
  social_feed: {
    type: "social_feed",
    displayName: "Social Feed",
    description: "Social media feed",
    category: "marketing",
    icon: "Share2",
  },
  // Media
  image_gallery: {
    type: "image_gallery",
    displayName: "Image Gallery",
    description: "Gallery of images",
    category: "core",
    icon: "Images",
  },
  video_gallery: {
    type: "video_gallery",
    displayName: "Video Gallery",
    description: "Gallery of videos",
    category: "core",
    icon: "Video",
  },
  before_after: {
    type: "before_after",
    displayName: "Before/After",
    description: "Before and after comparison",
    category: "core",
    icon: "ArrowLeftRight",
  },
  // Content
  blog_post_card: {
    type: "blog_post_card",
    displayName: "Blog Post Card",
    description: "Blog post card",
    category: "marketing",
    icon: "FileText",
  },
  timeline: {
    type: "timeline",
    displayName: "Timeline",
    description: "Timeline display",
    category: "marketing",
    icon: "Clock",
  },
  pricing_table: {
    type: "pricing_table",
    displayName: "Pricing Table",
    description: "Pricing table",
    category: "marketing",
    icon: "DollarSign",
  },
  // Layout
  tabs: {
    type: "tabs",
    displayName: "Tabs",
    description: "Tabbed content",
    category: "utility",
    icon: "Layout",
  },
  accordion: {
    type: "accordion",
    displayName: "Accordion",
    description: "Accordion content",
    category: "utility",
    icon: "ChevronDown",
  },
  // Utility
  contact_form: {
    type: "contact_form",
    displayName: "Contact Form",
    description: "Contact form",
    category: "utility",
    icon: "Mail",
  },
  embed: {
    type: "embed",
    displayName: "Embed",
    description: "Embedded content",
    category: "utility",
    icon: "Code",
  },
  announcement_bar: {
    type: "announcement_bar",
    displayName: "Announcement Bar",
    description: "Announcement bar",
    category: "utility",
    icon: "Bell",
  },
  map_location: {
    type: "map_location",
    displayName: "Map Location",
    description: "Map location",
    category: "utility",
    icon: "MapPin",
  },
};

/**
 * Get block metadata by type
 */
export function getBlockMetadata(type: BlockType): BlockMetadata {
  return blockMetadata[type];
}

/**
 * Get blocks by category
 */
export function getBlocksByCategory(category: BlockCategory): BlockMetadata[] {
  return Object.values(blockMetadata).filter(
    (meta) => meta.category === category,
  );
}

/**
 * Get all block categories
 */
export function getBlockCategories(): BlockCategory[] {
  return ["core", "marketing", "commerce", "utility"];
}
