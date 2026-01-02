"use client";

import type React from "react";
import type { BlockType } from "../types";
import { AnnouncementBarBlock } from "./announcement-bar-block";
import { CollectionShowcaseBlock } from "./collection-showcase-block";
// Utility Blocks
import { ContactFormBlock } from "./contact-form-block";
import { CountdownTimerBlock } from "./countdown-timer-block";
import { EmbedBlock } from "./embed-block";
import { FaqBlock } from "./faq-block";
import { FeaturedProductBlock } from "./featured-product-block";
// Core Blocks
import { HeroBlock } from "./hero-block";
import { ImageBlock } from "./image-block";
import { ImageGalleryBlock } from "./image-gallery-block";
import { InstagramFeedBlock } from "./instagram-feed-block";
import { NewsletterBlock } from "./newsletter-block";
import { ProductCardBlock } from "./product-card-block";
import { ProductCarouselBlock } from "./product-carousel-block";
// Commerce Blocks
import { ProductGridBlock } from "./product-grid-block";
import { RichTextBlock } from "./rich-text-block";
import { SpacerBlock } from "./spacer-block";
// Marketing Blocks
import { TestimonialsBlock } from "./testimonials-block";
import { ThreeColumnFeatureBlock } from "./three-column-feature-block";
// Layout Blocks
import { TwoColumnFeatureBlock } from "./two-column-feature-block";
import type { BlockComponentProps } from "./types";
import { UspHighlightsBlock } from "./usp-highlights-block";
import { VideoBlock } from "./video-block";

// Stub components for blocks not yet implemented
function StubBlock({ props }: BlockComponentProps<Record<string, unknown>>) {
  const blockType = (props.type as string) || "unknown";
  return (
    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
      Block type "{blockType}" not yet implemented
    </div>
  );
}

export const BLOCK_REGISTRY: Record<
  BlockType,
  React.ComponentType<BlockComponentProps<any>>
> = {
  // Core
  rich_text: RichTextBlock,
  image: ImageBlock,
  video: VideoBlock,
  spacer: SpacerBlock,
  // Marketing
  hero: HeroBlock,
  two_column_feature: TwoColumnFeatureBlock,
  three_column_feature: ThreeColumnFeatureBlock,
  testimonials: TestimonialsBlock,
  testimonial_card: StubBlock,
  faq: FaqBlock,
  newsletter: NewsletterBlock,
  countdown_timer: CountdownTimerBlock,
  social_proof: StubBlock,
  stats: StubBlock,
  // Commerce
  product_grid: ProductGridBlock,
  product_carousel: ProductCarouselBlock,
  product_card: ProductCardBlock,
  collection_showcase: CollectionShowcaseBlock,
  collection_card: StubBlock,
  category_navigation: StubBlock,
  category_card: StubBlock,
  featured_product: FeaturedProductBlock,
  bundle_card: StubBlock,
  usp_highlights: UspHighlightsBlock,
  comparison_table: StubBlock,
  // Social Media
  instagram_feed: InstagramFeedBlock,
  social_feed: StubBlock,
  // Media
  image_gallery: ImageGalleryBlock,
  video_gallery: StubBlock,
  before_after: StubBlock,
  // Content
  blog_post_card: StubBlock,
  timeline: StubBlock,
  pricing_table: StubBlock,
  // Layout
  tabs: StubBlock,
  accordion: StubBlock,
  // Utility
  contact_form: ContactFormBlock,
  embed: EmbedBlock,
  announcement_bar: AnnouncementBarBlock,
  map_location: StubBlock,
};
