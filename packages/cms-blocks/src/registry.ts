import { z } from "zod";
import type { BlockDefinition } from "./types";

// Core Blocks

export const richTextBlock: BlockDefinition = {
  type: "rich_text",
  displayName: "Rich Text",
  description: "Rich text content with formatting",
  category: "core",
  propsSchema: z.object({
    content: z.unknown().optional(), // Lexical JSON or markdown string
  }),
  defaultProps: {
    content: null,
  },
};

export const imageBlock: BlockDefinition = {
  type: "image",
  displayName: "Image",
  description: "Single image with optional caption",
  category: "core",
  propsSchema: z.object({
    src: z.string().url().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
  }),
  defaultProps: {
    src: "",
    alt: "",
    caption: "",
  },
};

export const videoBlock: BlockDefinition = {
  type: "video",
  displayName: "Video",
  description: "Embedded video content",
  category: "core",
  propsSchema: z.object({
    url: z.string().url().optional(),
    title: z.string().optional(),
  }),
  defaultProps: {
    url: "",
    title: "",
  },
};

export const spacerBlock: BlockDefinition = {
  type: "spacer",
  displayName: "Spacer",
  description: "Vertical spacing element",
  category: "core",
  propsSchema: z.object({
    height: z.enum(["xs", "sm", "md", "lg", "xl"]).default("md"),
  }),
  defaultProps: {
    height: "md",
  },
};

// Marketing Blocks

export const heroBlock: BlockDefinition = {
  type: "hero",
  displayName: "Hero Banner",
  description: "Large banner with title, subtitle, and CTA",
  category: "marketing",
  propsSchema: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    backgroundImage: z.string().url().optional(),
    ctaText: z.string().optional(),
    ctaLink: z.string().optional(),
  }),
  defaultProps: {
    title: "",
    subtitle: "",
    backgroundImage: "",
    ctaText: "",
    ctaLink: "",
  },
};

export const twoColumnFeatureBlock: BlockDefinition = {
  type: "two_column_feature",
  displayName: "Two Column Feature",
  description: "Two-column layout with content",
  category: "marketing",
  propsSchema: z.object({
    leftContent: z.string().optional(),
    rightContent: z.string().optional(),
    leftImage: z.string().url().optional(),
    rightImage: z.string().url().optional(),
  }),
  defaultProps: {
    leftContent: "",
    rightContent: "",
    leftImage: "",
    rightImage: "",
  },
};

export const threeColumnFeatureBlock: BlockDefinition = {
  type: "three_column_feature",
  displayName: "Three Column Feature",
  description: "Three-column layout with content",
  category: "marketing",
  propsSchema: z.object({
    column1Content: z.string().optional(),
    column2Content: z.string().optional(),
    column3Content: z.string().optional(),
    column1Image: z.string().url().optional(),
    column2Image: z.string().url().optional(),
    column3Image: z.string().url().optional(),
  }),
  defaultProps: {
    column1Content: "",
    column2Content: "",
    column3Content: "",
    column1Image: "",
    column2Image: "",
    column3Image: "",
  },
};

export const testimonialsBlock: BlockDefinition = {
  type: "testimonials",
  displayName: "Testimonials",
  description: "Customer testimonials carousel",
  category: "marketing",
  propsSchema: z.object({
    testimonials: z
      .array(
        z.object({
          name: z.string(),
          text: z.string(),
          role: z.string().optional(),
          avatar: z.string().url().optional(),
        }),
      )
      .default([]),
  }),
  defaultProps: {
    testimonials: [],
  },
};

export const faqBlock: BlockDefinition = {
  type: "faq",
  displayName: "FAQ",
  description: "Frequently asked questions",
  category: "marketing",
  propsSchema: z.object({
    items: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .default([]),
  }),
  defaultProps: {
    items: [],
  },
};

export const newsletterBlock: BlockDefinition = {
  type: "newsletter",
  displayName: "Newsletter Signup",
  description: "Email newsletter subscription form",
  category: "marketing",
  propsSchema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    placeholder: z.string().default("Enter your email"),
  }),
  defaultProps: {
    title: "Subscribe to our newsletter",
    description: "",
    placeholder: "Enter your email",
  },
};

// Commerce Blocks

export const productGridBlock: BlockDefinition = {
  type: "product_grid",
  displayName: "Product Grid",
  description: "Display products in a grid layout",
  category: "commerce",
  propsSchema: z.object({
    title: z.string().optional(),
    productIds: z.array(z.string().uuid()).min(1),
    columns: z.enum(["2", "3", "4"]).default("3"),
  }),
  defaultProps: {
    productIds: [],
    columns: "3",
  },
};

export const productCarouselBlock: BlockDefinition = {
  type: "product_carousel",
  displayName: "Product Carousel",
  description: "Horizontal scrolling product carousel",
  category: "commerce",
  propsSchema: z.object({
    title: z.string().optional(),
    productIds: z.array(z.string().uuid()).min(1),
  }),
  defaultProps: {
    productIds: [],
  },
};

export const collectionShowcaseBlock: BlockDefinition = {
  type: "collection_showcase",
  displayName: "Collection Showcase",
  description: "Display a collection with products",
  category: "commerce",
  propsSchema: z.object({
    collectionId: z.string().uuid(),
    title: z.string().optional(),
    limit: z.number().default(4),
  }),
  defaultProps: {
    collectionId: "",
    limit: 4,
  },
};

export const categoryNavigationBlock: BlockDefinition = {
  type: "category_navigation",
  displayName: "Category Navigation",
  description: "Category links navigation",
  category: "commerce",
  propsSchema: z.object({
    categoryIds: z.array(z.string().uuid()).default([]),
  }),
  defaultProps: {
    categoryIds: [],
  },
};

export const featuredProductBlock: BlockDefinition = {
  type: "featured_product",
  displayName: "Featured Product",
  description: "Highlight a single product",
  category: "commerce",
  propsSchema: z.object({
    productId: z.string().uuid(),
  }),
  defaultProps: {
    productId: "",
  },
};

export const uspHighlightsBlock: BlockDefinition = {
  type: "usp_highlights",
  displayName: "USP Highlights",
  description: "Unique selling points (Free Shipping, Easy Returns, etc.)",
  category: "commerce",
  propsSchema: z.object({
    items: z
      .array(
        z.object({
          icon: z.string().optional(),
          title: z.string(),
          description: z.string().optional(),
        }),
      )
      .default([]),
  }),
  defaultProps: {
    items: [],
  },
};

// Utility Blocks

export const contactFormBlock: BlockDefinition = {
  type: "contact_form",
  displayName: "Contact Form",
  description: "Contact form with fields",
  category: "utility",
  propsSchema: z.object({
    title: z.string().optional(),
    fields: z.array(z.string()).default(["name", "email", "message"]),
  }),
  defaultProps: {
    title: "Contact Us",
    fields: ["name", "email", "message"],
  },
};

export const embedBlock: BlockDefinition = {
  type: "embed",
  displayName: "Embed",
  description: "Embed external content (iframe)",
  category: "utility",
  propsSchema: z.object({
    url: z.string().url().optional(),
    html: z.string().optional(),
  }),
  defaultProps: {
    url: "",
    html: "",
  },
};

export const announcementBarBlock: BlockDefinition = {
  type: "announcement_bar",
  displayName: "Announcement Bar",
  description: "Top announcement banner/marquee",
  category: "utility",
  propsSchema: z.object({
    text: z.string(),
    link: z.string().optional(),
    linkText: z.string().optional(),
  }),
  defaultProps: {
    text: "",
    link: "",
    linkText: "",
  },
};

export const productCardBlock: BlockDefinition = {
  type: "product_card",
  displayName: "Product Card",
  description: "Standalone product card component",
  category: "commerce",
  propsSchema: z.object({
    productId: z.string().uuid(),
    style: z.enum(["compact", "detailed", "featured"]).default("detailed"),
  }),
  defaultProps: {
    productId: "",
    style: "detailed",
  },
};

export const collectionCardBlock: BlockDefinition = {
  type: "collection_card",
  displayName: "Collection Card",
  description: "Standalone collection card component",
  category: "commerce",
  propsSchema: z.object({
    collectionId: z.string().uuid(),
  }),
  defaultProps: {
    collectionId: "",
  },
};

export const categoryCardBlock: BlockDefinition = {
  type: "category_card",
  displayName: "Category Card",
  description: "Category card component",
  category: "commerce",
  propsSchema: z.object({
    categoryId: z.string().uuid(),
  }),
  defaultProps: {
    categoryId: "",
  },
};

export const bundleCardBlock: BlockDefinition = {
  type: "bundle_card",
  displayName: "Bundle Card",
  description: "Product bundle card",
  category: "commerce",
  propsSchema: z.object({
    bundleId: z.string().uuid(),
  }),
  defaultProps: {
    bundleId: "",
  },
};

export const comparisonTableBlock: BlockDefinition = {
  type: "comparison_table",
  displayName: "Comparison Table",
  description: "Product comparison table",
  category: "commerce",
  propsSchema: z.object({
    productIds: z.array(z.string().uuid()).min(2),
    features: z.array(z.string()).default([]),
  }),
  defaultProps: {
    productIds: [],
    features: [],
  },
};

// New Marketing Blocks

export const testimonialCardBlock: BlockDefinition = {
  type: "testimonial_card",
  displayName: "Testimonial Card",
  description: "Individual testimonial card",
  category: "marketing",
  propsSchema: z.object({
    name: z.string(),
    text: z.string(),
    role: z.string().optional(),
    avatar: z.string().url().optional(),
    rating: z.number().min(0).max(5).optional(),
  }),
  defaultProps: {
    name: "",
    text: "",
    role: "",
    avatar: "",
    rating: 5,
  },
};

export const countdownTimerBlock: BlockDefinition = {
  type: "countdown_timer",
  displayName: "Countdown Timer",
  description: "Countdown timer for sales/promotions",
  category: "marketing",
  propsSchema: z.object({
    targetDate: z.string(), // ISO date string
    displayFormat: z.enum(["full", "compact"]).default("full"),
    message: z.string().optional(),
    redirectUrl: z.string().url().optional(),
  }),
  defaultProps: {
    targetDate: "",
    displayFormat: "full",
    message: "",
    redirectUrl: "",
  },
};

export const socialProofBlock: BlockDefinition = {
  type: "social_proof",
  displayName: "Social Proof",
  description: "Recent purchases, visitor count, trust badges",
  category: "marketing",
  propsSchema: z.object({
    type: z
      .enum(["purchases", "visitors", "badges", "avatars"])
      .default("purchases"),
    count: z.number().optional(),
    items: z.array(z.string()).default([]),
  }),
  defaultProps: {
    type: "purchases",
    count: 0,
    items: [],
  },
};

export const statsBlock: BlockDefinition = {
  type: "stats",
  displayName: "Statistics",
  description: "Statistics/metrics display",
  category: "marketing",
  propsSchema: z.object({
    items: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
          icon: z.string().optional(),
        }),
      )
      .default([]),
    columns: z.enum(["2", "3", "4"]).default("4"),
  }),
  defaultProps: {
    items: [],
    columns: "4",
  },
};

// Social Media Blocks

export const instagramFeedBlock: BlockDefinition = {
  type: "instagram_feed",
  displayName: "Instagram Feed",
  description: "Instagram feed integration",
  category: "marketing",
  propsSchema: z.object({
    username: z.string().optional(),
    accessToken: z.string().optional(),
    postCount: z.enum(["6", "9", "12"]).default("6"),
    columns: z.enum(["2", "3", "4"]).default("3"),
    profileLink: z.string().url().optional(),
  }),
  defaultProps: {
    username: "",
    accessToken: "",
    postCount: "6",
    columns: "3",
    profileLink: "",
  },
};

export const socialFeedBlock: BlockDefinition = {
  type: "social_feed",
  displayName: "Social Feed",
  description: "Generic social media feed (Twitter/X, Facebook)",
  category: "marketing",
  propsSchema: z.object({
    platform: z.enum(["twitter", "facebook"]).default("twitter"),
    username: z.string().optional(),
    embedCode: z.string().optional(),
  }),
  defaultProps: {
    platform: "twitter",
    username: "",
    embedCode: "",
  },
};

// Media Blocks

export const imageGalleryBlock: BlockDefinition = {
  type: "image_gallery",
  displayName: "Image Gallery",
  description: "Image gallery/carousel",
  category: "marketing",
  propsSchema: z.object({
    images: z
      .array(
        z.object({
          src: z.string().url(),
          alt: z.string().optional(),
          caption: z.string().optional(),
        }),
      )
      .default([]),
    layout: z.enum(["grid", "carousel"]).default("grid"),
    columns: z.enum(["2", "3", "4"]).default("3"),
    lightbox: z.boolean().default(true),
  }),
  defaultProps: {
    images: [],
    layout: "grid",
    columns: "3",
    lightbox: true,
  },
};

export const videoGalleryBlock: BlockDefinition = {
  type: "video_gallery",
  displayName: "Video Gallery",
  description: "Video gallery",
  category: "marketing",
  propsSchema: z.object({
    videos: z
      .array(
        z.object({
          url: z.string().url(),
          title: z.string().optional(),
          thumbnail: z.string().url().optional(),
        }),
      )
      .default([]),
    columns: z.enum(["2", "3", "4"]).default("3"),
  }),
  defaultProps: {
    videos: [],
    columns: "3",
  },
};

export const beforeAfterBlock: BlockDefinition = {
  type: "before_after",
  displayName: "Before/After",
  description: "Before/after comparison slider",
  category: "marketing",
  propsSchema: z.object({
    beforeImage: z.string().url(),
    afterImage: z.string().url(),
    beforeLabel: z.string().optional(),
    afterLabel: z.string().optional(),
  }),
  defaultProps: {
    beforeImage: "",
    afterImage: "",
    beforeLabel: "Before",
    afterLabel: "After",
  },
};

// Content Blocks

export const blogPostCardBlock: BlockDefinition = {
  type: "blog_post_card",
  displayName: "Blog Post Card",
  description: "Blog post card",
  category: "marketing",
  propsSchema: z.object({
    postId: z.string().uuid(),
  }),
  defaultProps: {
    postId: "",
  },
};

export const timelineBlock: BlockDefinition = {
  type: "timeline",
  displayName: "Timeline",
  description: "Timeline/chronology display",
  category: "marketing",
  propsSchema: z.object({
    items: z
      .array(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          date: z.string().optional(),
          icon: z.string().optional(),
        }),
      )
      .default([]),
  }),
  defaultProps: {
    items: [],
  },
};

export const pricingTableBlock: BlockDefinition = {
  type: "pricing_table",
  displayName: "Pricing Table",
  description: "Pricing comparison table",
  category: "marketing",
  propsSchema: z.object({
    plans: z
      .array(
        z.object({
          name: z.string(),
          price: z.string(),
          period: z.string().optional(),
          features: z.array(z.string()).default([]),
          ctaText: z.string().optional(),
          ctaLink: z.string().optional(),
          highlighted: z.boolean().default(false),
        }),
      )
      .default([]),
  }),
  defaultProps: {
    plans: [],
  },
};

// Layout Blocks

export const tabsBlock: BlockDefinition = {
  type: "tabs",
  displayName: "Tabs",
  description: "Tabbed content",
  category: "marketing",
  propsSchema: z.object({
    tabs: z
      .array(
        z.object({
          label: z.string(),
          content: z.string().optional(),
        }),
      )
      .default([]),
  }),
  defaultProps: {
    tabs: [],
  },
};

export const accordionBlock: BlockDefinition = {
  type: "accordion",
  displayName: "Accordion",
  description: "Generic accordion component",
  category: "marketing",
  propsSchema: z.object({
    items: z
      .array(
        z.object({
          title: z.string(),
          content: z.string(),
        }),
      )
      .default([]),
  }),
  defaultProps: {
    items: [],
  },
};

// Utility Blocks

export const mapLocationBlock: BlockDefinition = {
  type: "map_location",
  displayName: "Map/Location",
  description: "Map/location embed",
  category: "utility",
  propsSchema: z.object({
    address: z.string(),
    provider: z.enum(["google", "mapbox"]).default("google"),
    apiKey: z.string().optional(),
    zoom: z.number().min(1).max(20).default(15),
    showDirections: z.boolean().default(true),
  }),
  defaultProps: {
    address: "",
    provider: "google",
    apiKey: "",
    zoom: 15,
    showDirections: true,
  },
};

// Registry

import type { BlockType } from "./types";

export const blockRegistry: Record<BlockType, BlockDefinition> = {
  // Core
  rich_text: richTextBlock,
  image: imageBlock,
  video: videoBlock,
  spacer: spacerBlock,
  // Marketing
  hero: heroBlock,
  two_column_feature: twoColumnFeatureBlock,
  three_column_feature: threeColumnFeatureBlock,
  testimonials: testimonialsBlock,
  testimonial_card: testimonialCardBlock,
  faq: faqBlock,
  newsletter: newsletterBlock,
  countdown_timer: countdownTimerBlock,
  social_proof: socialProofBlock,
  stats: statsBlock,
  // Commerce
  product_grid: productGridBlock,
  product_carousel: productCarouselBlock,
  product_card: productCardBlock,
  collection_showcase: collectionShowcaseBlock,
  collection_card: collectionCardBlock,
  category_navigation: categoryNavigationBlock,
  category_card: categoryCardBlock,
  featured_product: featuredProductBlock,
  bundle_card: bundleCardBlock,
  usp_highlights: uspHighlightsBlock,
  comparison_table: comparisonTableBlock,
  // Social Media
  instagram_feed: instagramFeedBlock,
  social_feed: socialFeedBlock,
  // Media
  image_gallery: imageGalleryBlock,
  video_gallery: videoGalleryBlock,
  before_after: beforeAfterBlock,
  // Content
  blog_post_card: blogPostCardBlock,
  timeline: timelineBlock,
  pricing_table: pricingTableBlock,
  // Layout
  tabs: tabsBlock,
  accordion: accordionBlock,
  // Utility
  contact_form: contactFormBlock,
  embed: embedBlock,
  announcement_bar: announcementBarBlock,
  map_location: mapLocationBlock,
};

/**
 * Get block definition by type
 */
export function getBlockDefinition(type: BlockType): BlockDefinition {
  return blockRegistry[type];
}

/**
 * Validate block props against its schema
 */
export function validateBlockProps(
  type: BlockType,
  props: unknown,
): { success: boolean; data?: unknown; error?: string } {
  const definition = getBlockDefinition(type);
  if (!definition) {
    return { success: false, error: `Unknown block type: ${type}` };
  }

  try {
    const validated = definition.propsSchema.parse(props);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", "),
      };
    }
    return { success: false, error: "Validation failed" };
  }
}
