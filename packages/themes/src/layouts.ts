import type { ComponentType } from "react";
import {
  MinimalFooterLayout,
  MinimalHeaderLayout,
  MinimalPageLayout,
} from "./themes/minimal/layouts";
import {
  ModernFooterLayout,
  ModernHeaderLayout,
  ModernPageLayout,
} from "./themes/modern/layouts";

export interface ThemeLayouts {
  Header: ComponentType<{ children?: React.ReactNode; className?: string }>;
  Footer: ComponentType<{ children?: React.ReactNode; className?: string }>;
  Page: ComponentType<{ children: React.ReactNode; className?: string }>;
}

/**
 * Get theme layouts by theme ID
 */
export function getThemeLayouts(themeId: string): ThemeLayouts | null {
  switch (themeId) {
    case "modern":
      return {
        Header: ModernHeaderLayout,
        Footer: ModernFooterLayout,
        Page: ModernPageLayout,
      };
    case "minimal":
      return {
        Header: MinimalHeaderLayout,
        Footer: MinimalFooterLayout,
        Page: MinimalPageLayout,
      };
    default:
      return null;
  }
}
