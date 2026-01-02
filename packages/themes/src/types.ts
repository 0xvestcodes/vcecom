import { z } from "zod";

/**
 * Theme color palette
 */
export const themeColorsSchema = z.object({
  primary: z.string().describe("Primary brand color"),
  secondary: z.string().describe("Secondary brand color"),
  accent: z.string().describe("Accent color"),
  background: z.string().describe("Background color"),
  foreground: z.string().describe("Foreground/text color"),
  muted: z.string().optional().describe("Muted background color"),
  mutedForeground: z.string().optional().describe("Muted text color"),
  border: z.string().optional().describe("Border color"),
  input: z.string().optional().describe("Input background color"),
  ring: z.string().optional().describe("Focus ring color"),
  card: z.string().optional().describe("Card background color"),
  cardForeground: z.string().optional().describe("Card text color"),
  destructive: z.string().optional().describe("Destructive action color"),
  destructiveForeground: z
    .string()
    .optional()
    .describe("Destructive text color"),
});

export type ThemeColors = z.infer<typeof themeColorsSchema>;

/**
 * Typography settings
 */
export const themeTypographySchema = z.object({
  fontFamily: z
    .string()
    .default("Inter, sans-serif")
    .describe("Primary font family"),
  fontFamilyHeading: z.string().optional().describe("Heading font family"),
  fontSizes: z
    .object({
      xs: z.string().default("0.75rem"),
      sm: z.string().default("0.875rem"),
      base: z.string().default("1rem"),
      lg: z.string().default("1.125rem"),
      xl: z.string().default("1.25rem"),
      "2xl": z.string().default("1.5rem"),
      "3xl": z.string().default("1.875rem"),
      "4xl": z.string().default("2.25rem"),
      "5xl": z.string().default("3rem"),
    })
    .optional(),
  fontWeights: z
    .object({
      normal: z.number().default(400),
      medium: z.number().default(500),
      semibold: z.number().default(600),
      bold: z.number().default(700),
    })
    .optional(),
  lineHeights: z
    .object({
      tight: z.number().default(1.25),
      normal: z.number().default(1.5),
      relaxed: z.number().default(1.75),
    })
    .optional(),
});

export type ThemeTypography = z.infer<typeof themeTypographySchema>;

/**
 * Spacing scale
 */
export const themeSpacingSchema = z.object({
  base: z.string().default("1rem").describe("Base spacing unit"),
  xs: z.string().default("0.25rem"),
  sm: z.string().default("0.5rem"),
  md: z.string().default("1rem"),
  lg: z.string().default("1.5rem"),
  xl: z.string().default("2rem"),
  "2xl": z.string().default("3rem"),
  "3xl": z.string().default("4rem"),
});

export type ThemeSpacing = z.infer<typeof themeSpacingSchema>;

/**
 * Button styles
 */
export const themeButtonSchema = z.object({
  borderRadius: z.enum(["none", "sm", "md", "lg", "full"]).default("md"),
  padding: z
    .object({
      sm: z.string().default("0.5rem 1rem"),
      md: z.string().default("0.75rem 1.5rem"),
      lg: z.string().default("1rem 2rem"),
    })
    .optional(),
  variants: z
    .object({
      default: z
        .object({
          background: z.string().optional(),
          color: z.string().optional(),
        })
        .optional(),
      outline: z
        .object({
          border: z.string().optional(),
          color: z.string().optional(),
        })
        .optional(),
      ghost: z
        .object({
          color: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type ThemeButton = z.infer<typeof themeButtonSchema>;

/**
 * Layout settings
 */
export const themeLayoutSchema = z.object({
  containerMaxWidth: z.string().default("1280px"),
  headerHeight: z.string().default("4rem"),
  footerHeight: z.string().default("auto"),
  sidebarWidth: z.string().optional(),
  cartDrawerWidth: z.string().default("400px"),
});

export type ThemeLayout = z.infer<typeof themeLayoutSchema>;

/**
 * Page template structure (matches CMS page structure)
 */
export const pageTemplateSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      layout: z.enum(["container", "full"]),
      background: z
        .enum(["accent", "muted", "primary", "secondary"])
        .optional(),
      padding: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
      blocks: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          order: z.number(),
          props: z.record(z.string(), z.unknown()),
          style: z
            .object({
              variant: z
                .enum(["default", "inset", "card", "section", "ghost"])
                .optional(),
              padding: z.enum(["none", "sm", "md", "lg"]).optional(),
              align: z.enum(["left", "center", "right"]).optional(),
            })
            .optional(),
        }),
      ),
    }),
  ),
});

export type PageTemplate = z.infer<typeof pageTemplateSchema>;

/**
 * Theme templates (default page structures)
 */
export const themeTemplatesSchema = z
  .record(z.string(), pageTemplateSchema)
  .optional();

export type ThemeTemplates = z.infer<typeof themeTemplatesSchema>;

/**
 * Complete theme definition
 */
export const themeSchema = z.object({
  id: z
    .string()
    .describe("Unique theme identifier (e.g., 'modern', 'minimal')"),
  name: z.string().describe("Display name for the theme"),
  description: z.string().optional().describe("Theme description"),
  version: z.string().default("1.0.0").describe("Theme version"),
  colors: themeColorsSchema,
  typography: themeTypographySchema,
  spacing: themeSpacingSchema,
  buttons: themeButtonSchema,
  layout: themeLayoutSchema,
  // Layout component paths (for dynamic imports)
  layouts: z
    .object({
      header: z.string().optional().describe("Path to header layout component"),
      footer: z.string().optional().describe("Path to footer layout component"),
      page: z
        .string()
        .optional()
        .describe("Path to page layout wrapper component"),
    })
    .optional(),
  // Default page templates
  templates: themeTemplatesSchema,
});

export type Theme = z.infer<typeof themeSchema>;

/**
 * Theme settings override (stored in DB)
 */
export interface ThemeSettingsOverride {
  themeId: string;
  colors?: Partial<ThemeColors>;
  typography?: Partial<ThemeTypography>;
  spacing?: Partial<ThemeSpacing>;
  buttons?: Partial<ThemeButton>;
  layout?: Partial<ThemeLayout>;
}

/**
 * Merged theme (base theme + overrides)
 */
export interface MergedTheme extends Theme {
  isActive?: boolean;
  settingsOverrides?: ThemeSettingsOverride;
}
