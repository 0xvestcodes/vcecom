import { z } from "zod";

/**
 * CONTENT_SCHEMA - Single Source of Truth
 *
 * This schema defines EXACTLY what content the storefront needs.
 * Backend + Admin MUST follow this contract.
 *
 * Storefront controls structure. Admin controls values.
 */

// Navigation Schema
const NavigationItemSchema = z.object({
  label: z.string(),
  href: z.string(),
  children: z
    .array(
      z.object({
        label: z.string(),
        href: z.string(),
      }),
    )
    .optional(),
});

export const NavigationSchema = z.object({
  items: z.array(NavigationItemSchema),
});

// Footer Schema
export const FooterSchema = z.object({
  columns: z
    .array(
      z.object({
        title: z.string(),
        links: z.array(
          z.object({
            label: z.string(),
            url: z.string(),
          }),
        ),
      }),
    )
    .optional(),
  copyright: z.string(),
  social: z
    .object({
      facebook: z.string().optional(),
      twitter: z.string().optional(),
      instagram: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .optional(),
});

// Homepage Hero Schema
const HeroSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  image: z.string(), // Image URL or key
  cta_label: z.string().optional(),
  cta_url: z.string().optional(),
});

// Homepage Section Schema
const HomepageSectionSchema = z.object({
  id: z.string(),
  type: z.enum(["richtext", "image", "cta", "hero", "highlights"]),
  required: z.boolean().default(false),
  fallback: z
    .object({
      type: z.enum(["default", "empty", "placeholder"]),
      content: z.unknown().optional(),
    })
    .optional(),
  content: z.unknown(), // Content varies by type
});

// Homepage Schema
export const HomepageSchema = z.object({
  hero: HeroSchema,
  sections: z.array(HomepageSectionSchema).optional(),
  highlights: z
    .array(
      z.object({
        icon: z.string().optional(), // Image URL or key
        title: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
});

// Theme Settings Schema (Shadcn-style tokens only)
export const ThemeSettingsSchema = z.object({
  colors: z
    .object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      accent: z.string().optional(),
      background: z.string().optional(),
      foreground: z.string().optional(),
      muted: z.string().optional(),
      mutedForeground: z.string().optional(),
      border: z.string().optional(),
      input: z.string().optional(),
      ring: z.string().optional(),
      card: z.string().optional(),
      cardForeground: z.string().optional(),
      destructive: z.string().optional(),
      destructiveForeground: z.string().optional(),
    })
    .optional(),
  typography: z
    .object({
      fontFamily: z.string().optional(),
      fontFamilyHeading: z.string().optional(),
    })
    .optional(),
  radii: z
    .object({
      base: z.string().optional(),
      lg: z.string().optional(),
      xl: z.string().optional(),
    })
    .optional(),
  shadows: z
    .object({
      sm: z.string().optional(),
      md: z.string().optional(),
      lg: z.string().optional(),
    })
    .optional(),
  layout: z
    .object({
      containerMaxWidth: z.string().optional(),
    })
    .optional(),
});

// SEO Global Schema
export const SeoGlobalSchema = z.object({
  site_name: z.string(),
  default_title: z.string(),
  default_description: z.string(),
  default_og_image: z.string().optional(), // Image URL or key
});

// Maintenance Schema
export const MaintenanceSchema = z.object({
  enabled: z.boolean().default(false),
  message: z.string(),
});

// Page Section Schema (for static pages)
const PageSectionSchema = z.object({
  id: z.string(),
  type: z.enum(["richtext", "image", "cta"]),
  required: z.boolean().default(false),
  fallback: z
    .object({
      type: z.enum(["default", "empty", "placeholder"]),
      content: z.unknown().optional(),
    })
    .optional(),
  content: z.unknown(), // Content varies by type
});

// SEO Schema (per-page)
const SeoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  og_image: z.string().optional(), // Image URL or key
});

// Page Schema (for static pages like About, Contact, FAQ, Legal)
export const PageSchema = z.object({
  title: z.string(),
  content: z.string(), // Rich text content
  image: z.string().optional(), // Image URL or key
  seo: SeoSchema.optional(),
  sections: z.array(PageSectionSchema).optional(),
});

// Blog Post Schema
export const BlogPostSchema = z.object({
  slug: z.string(),
  title: z.string(),
  excerpt: z.string().optional(),
  featuredImage: z.string().optional(), // Image URL or key
  content: z.string(), // Markdown content
  publishedAt: z.string().optional(), // ISO date string
  seo: SeoSchema.optional(),
});

/**
 * Master Content Schema
 *
 * Each key represents a content "global" that can be edited in admin.
 * Keys are fixed - admin cannot create new keys.
 */
export const CONTENT_SCHEMA = {
  navigation: NavigationSchema,
  footer: FooterSchema,
  homepage: HomepageSchema,
  theme_settings: ThemeSettingsSchema,
  seo_global: SeoGlobalSchema,
  maintenance: MaintenanceSchema,
  page_about: PageSchema,
  page_contact: PageSchema,
  page_faq: PageSchema,
  page_legal: PageSchema,
} as const;

/**
 * Content Keys - Type-safe list of all content keys
 */
export type ContentKey = keyof typeof CONTENT_SCHEMA;

/**
 * Infer types from schemas
 */
export type Navigation = z.infer<typeof NavigationSchema>;
export type Footer = z.infer<typeof FooterSchema>;
export type Homepage = z.infer<typeof HomepageSchema>;
export type ThemeSettings = z.infer<typeof ThemeSettingsSchema>;
export type SeoGlobal = z.infer<typeof SeoGlobalSchema>;
export type Maintenance = z.infer<typeof MaintenanceSchema>;
export type Page = z.infer<typeof PageSchema>;
export type BlogPost = z.infer<typeof BlogPostSchema>;

/**
 * All Content Type - what GET /content returns
 */
export type AllContent = {
  navigation: Navigation;
  footer: Footer;
  homepage: Homepage;
  theme_settings: ThemeSettings;
  seo_global: SeoGlobal;
  maintenance: Maintenance;
  page_about: Page;
  page_contact: Page;
  page_faq: Page;
  page_legal: Page;
};

/**
 * Validate content by key
 */
export function validateContent(
  key: ContentKey,
  data: unknown,
): { valid: boolean; errors?: z.ZodError } {
  const schema = CONTENT_SCHEMA[key];
  const result = schema.safeParse(data);

  if (result.success) {
    return { valid: true };
  }

  return { valid: false, errors: result.error };
}

/**
 * Export schema as JSON for backend sync
 */
export function exportSchemaAsJSON(): Record<string, unknown> {
  const schemaObj: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(CONTENT_SCHEMA)) {
    // Convert Zod schema to JSON-serializable format
    // This is a simplified representation - in production you might want
    // a more sophisticated schema serialization
    schemaObj[key] = {
      type: "object", // Zod object schema
      // Note: Full Zod schema serialization would require a library
      // For now, we'll store the schema definition structure
    };
  }

  return {
    version: "1.0.0", // Schema version
    keys: Object.keys(CONTENT_SCHEMA),
    schemas: schemaObj,
    // Include section definitions for pages
    pageSections: {
      homepage: {
        sections: [
          {
            id: "hero",
            type: "hero",
            required: true,
            fields: {
              title: "string",
              subtitle: "string",
              image: "image",
              cta_label: "string",
              cta_url: "string",
            },
          },
          {
            id: "highlights",
            type: "highlights",
            required: false,
            fallback: {
              type: "empty",
            },
            fields: {
              items: "array",
            },
          },
        ],
      },
      page_about: {
        sections: [
          {
            id: "content",
            type: "richtext",
            required: true,
            fields: {
              content: "richtext",
            },
          },
        ],
      },
      page_contact: {
        sections: [
          {
            id: "content",
            type: "richtext",
            required: true,
            fields: {
              content: "richtext",
            },
          },
        ],
      },
      page_faq: {
        sections: [
          {
            id: "content",
            type: "richtext",
            required: true,
            fields: {
              content: "richtext",
            },
          },
        ],
      },
      page_legal: {
        sections: [
          {
            id: "content",
            type: "richtext",
            required: true,
            fields: {
              content: "richtext",
            },
          },
        ],
      },
    },
  };
}
