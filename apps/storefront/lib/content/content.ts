/**
 * Content Fetching Utilities
 *
 * Uses hardcoded fallback content (content registry removed).
 * Content is now managed through code/config files only.
 */

import type { AllContent, ContentKey } from "../../content-schema";

export type ContentSource = "fallback";

export interface ContentWithSource<T> {
  data: T;
  source: ContentSource;
}

/**
 * Get all content (for initial page load)
 * Returns hardcoded fallback content
 */
export async function getAllContent(): Promise<ContentWithSource<AllContent>> {
  return {
    data: getFallbackContent(),
    source: "fallback",
  };
}

/**
 * Get single content by key
 * Returns hardcoded fallback content
 */
export async function getContent(
  key: ContentKey,
): Promise<ContentWithSource<unknown>> {
  const fallback = getFallbackForKey(key);
  return { data: fallback, source: "fallback" };
}

/**
 * Get blog posts
 */
export async function getBlogPosts(options?: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "newest" | "oldest" | "alphabetical";
}): Promise<{
  data: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt?: string;
    featuredImage?: string;
    publishedAt?: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}> {
  try {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.search) params.set("search", options.search);
    if (options?.sortBy) params.set("sortBy", options.sortBy);

    const response = await fetch(
      `${API_BASE_URL}/store/blog?${params.toString()}`,
      {
        next: { revalidate: 60 }, // Revalidate every minute for blog posts
      },
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch blog posts:", error);
    // Return empty result on error
    return {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }
}

/**
 * Get single blog post by slug
 */
export async function getBlogPost(slug: string): Promise<{
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  featuredImage?: string;
  content: string;
  publishedAt?: string;
  seo?: { title?: string; description?: string; og_image?: string };
} | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/store/blog/${slug}`, {
      next: { revalidate: 60 }, // Revalidate every minute for blog posts
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`API returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`Failed to fetch blog post "${slug}":`, error);
    return null;
  }
}

/**
 * Get fallback content for a key
 */
function getFallbackForKey(key: ContentKey): unknown {
  const fallbacks: Record<ContentKey, unknown> = {
    navigation: {
      items: [],
    },
    footer: {
      copyright: "© 2024 Store. All rights reserved.",
      columns: [],
    },
    homepage: {
      hero: {
        title: "Welcome",
        subtitle: "Welcome to our store",
        image: "",
      },
      sections: [],
    },
    theme_settings: {
      colors: {},
      typography: {},
      radii: {},
      shadows: {},
      layout: {},
    },
    seo_global: {
      site_name: "Store",
      default_title: "Store",
      default_description: "Welcome to our store",
    },
    maintenance: {
      enabled: false,
      message: "We're currently under maintenance. Please check back soon.",
    },
    page_about: {
      title: "About Us",
      content: "About us content",
    },
    page_contact: {
      title: "Contact Us",
      content: "Contact us content",
    },
    page_faq: {
      title: "FAQ",
      content: "Frequently asked questions",
    },
    page_legal: {
      title: "Legal",
      content: "Legal information",
    },
  };

  return fallbacks[key] || {};
}

/**
 * Get all fallback content
 */
function getFallbackContent(): AllContent {
  return {
    navigation: getFallbackForKey("navigation") as AllContent["navigation"],
    footer: getFallbackForKey("footer") as AllContent["footer"],
    homepage: getFallbackForKey("homepage") as AllContent["homepage"],
    theme_settings: getFallbackForKey(
      "theme_settings",
    ) as AllContent["theme_settings"],
    seo_global: getFallbackForKey("seo_global") as AllContent["seo_global"],
    maintenance: getFallbackForKey("maintenance") as AllContent["maintenance"],
    page_about: getFallbackForKey("page_about") as AllContent["page_about"],
    page_contact: getFallbackForKey(
      "page_contact",
    ) as AllContent["page_contact"],
    page_faq: getFallbackForKey("page_faq") as AllContent["page_faq"],
    page_legal: getFallbackForKey("page_legal") as AllContent["page_legal"],
  };
}
