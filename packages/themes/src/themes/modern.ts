import type { Theme } from "../types";

export const modernTheme: Theme = {
  id: "modern",
  name: "Modern",
  description:
    "A sleek, contemporary theme with bold typography and vibrant colors",
  version: "1.0.0",
  colors: {
    primary: "#000000",
    secondary: "#666666",
    accent: "#0066FF",
    background: "#FFFFFF",
    foreground: "#000000",
    muted: "#F5F5F5",
    mutedForeground: "#737373",
    border: "#E5E5E5",
    input: "#FFFFFF",
    ring: "#0066FF",
    card: "#FFFFFF",
    cardForeground: "#000000",
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",
  },
  typography: {
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyHeading: "Inter, sans-serif",
    fontSizes: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
    },
    fontWeights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    base: "1rem",
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
    "3xl": "4rem",
  },
  buttons: {
    borderRadius: "md",
    padding: {
      sm: "0.5rem 1rem",
      md: "0.75rem 1.5rem",
      lg: "1rem 2rem",
    },
    variants: {
      default: {
        background: "#000000",
        color: "#FFFFFF",
      },
      outline: {
        border: "#000000",
        color: "#000000",
      },
      ghost: {
        color: "#000000",
      },
    },
  },
  layout: {
    containerMaxWidth: "1280px",
    headerHeight: "4rem",
    footerHeight: "auto",
    cartDrawerWidth: "400px",
  },
  layouts: {
    header: "@vcecom/themes/themes/modern/layouts/header",
    footer: "@vcecom/themes/themes/modern/layouts/footer",
    page: "@vcecom/themes/themes/modern/layouts/page",
  },
  templates: undefined, // Will be loaded from JSON files
};
