import type { Metadata } from "next";

/**
 * SEO Global data structure (hardcoded defaults)
 */
export interface SeoGlobalData {
  site_name?: string;
  default_title?: string;
  default_description?: string;
  default_og_image?: string;
  // Comprehensive SEO fields
  title?: string;
  description?: string;
  keywords?: string[];
  authors?: string[];
  creator?: string;
  publisher?: string;
  robots?: string;
  category?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogSiteName?: string;
  ogLocale?: string;
  ogType?: string;
  ogImages?: Array<{
    url: string;
    width?: number;
    height?: number;
    alt?: string;
  }>;
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  twitterTitle?: string;
  twitterDescription?: string;
  twitterCreator?: string;
  twitterSite?: string;
  twitterImages?: Array<
    string | { url: string; width?: number; height?: number; alt?: string }
  >;
}

/**
 * Get SEO global settings (hardcoded defaults)
 */
export async function getSeoGlobal(): Promise<SeoGlobalData | undefined> {
  // Return hardcoded defaults - content registry removed
  return {
    site_name: "Storefront",
    default_title: "Storefront",
    default_description: "Modern ecommerce storefront",
  };
}

/**
 * Generate base metadata with hardcoded defaults
 * Can be extended with page-specific metadata
 */
export async function generateBaseMetadata(
  overrides?: Partial<Metadata>,
): Promise<Metadata> {
  const seoGlobal = await getSeoGlobal();

  // Use hardcoded defaults
  const siteName = seoGlobal?.site_name || "Storefront";
  const title =
    overrides?.title?.toString() || seoGlobal?.default_title || siteName;
  const description =
    overrides?.description?.toString() ||
    seoGlobal?.default_description ||
    "Modern ecommerce storefront";

  return {
    title: title,
    description: description,
    keywords: overrides?.keywords,
    authors: overrides?.authors,
    creator: overrides?.creator,
    publisher: overrides?.publisher,
    robots: overrides?.robots,
    category: overrides?.category,
    alternates: overrides?.alternates,
    openGraph: {
      title: title,
      description: description,
      siteName: siteName,
      type: "website",
      ...overrides?.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
      ...overrides?.twitter,
    },
    ...overrides,
  };
}
