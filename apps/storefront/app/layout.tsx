import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { PreviewHandler } from "@/components/cms/preview-handler";
import { ThemeFooter } from "@/components/cms/theme-footer";
import { ThemeHeader } from "@/components/cms/theme-header";
import { MaintenancePage } from "@/components/maintenance-page";
import { Providers } from "@/components/providers";
import { SessionSync } from "@/components/session-sync";
import { ThemeStyles } from "@/components/theme/theme-styles";
import type { Footer, Navigation } from "@/content-schema";
import { fetchStoreConfig } from "@/lib/api/store-config";
import { getAllContent } from "@/lib/content/content";
import { generateBaseMetadata } from "@/lib/seo/metadata-helpers";

const inter = Inter({ subsets: ["latin"] });

interface RootLayoutProps {
  children: React.ReactNode;
}

export async function generateMetadata(): Promise<Metadata> {
  const storeConfig = await fetchStoreConfig();

  // Use SEO global settings from content registry
  // Fallback to store config name if SEO global doesn't have site_name
  const baseMetadata = await generateBaseMetadata();

  // If store config has a name but SEO global doesn't, use it as fallback
  if (storeConfig?.name && !baseMetadata.openGraph?.siteName) {
    return {
      ...baseMetadata,
      openGraph: {
        ...baseMetadata.openGraph,
        siteName: storeConfig.name,
      },
    };
  }

  return baseMetadata;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  // Fetch store config server-side
  const storeConfig = await fetchStoreConfig();

  // Fetch all content server-side
  const contentResult = await getAllContent();
  const content = contentResult.data;

  // Check maintenance mode
  const maintenance = content.maintenance;
  if (maintenance?.enabled) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <MaintenancePage message={maintenance.message} />
        </body>
      </html>
    );
  }

  // Apply theme settings (simplified - just CSS variables)
  const themeSettings = content.theme_settings;
  const themeCSS = generateThemeCSSFromSettings(themeSettings);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {themeCSS && <ThemeStyles css={themeCSS} />}
          <SessionSync />
          <Suspense fallback={null}>
            <PreviewHandler />
          </Suspense>
          <ThemeHeader
            navigation={content.navigation as Navigation}
            storeConfig={storeConfig || undefined}
          />
          <main>{children}</main>
          <ThemeFooter footer={content.footer as Footer} />
        </Providers>
      </body>
    </html>
  );
}

/**
 * Generate CSS from theme settings (simplified - only CSS variables)
 */
function generateThemeCSSFromSettings(themeSettings: unknown): string {
  if (!themeSettings || typeof themeSettings !== "object") {
    return "";
  }

  const settings = themeSettings as {
    colors?: Record<string, string>;
    typography?: Record<string, string>;
    radii?: Record<string, string>;
    shadows?: Record<string, string>;
    layout?: Record<string, string>;
  };

  const cssVars: string[] = [];

  // Colors
  if (settings.colors) {
    for (const [key, value] of Object.entries(settings.colors)) {
      cssVars.push(`  --${key}: ${value};`);
    }
  }

  // Typography
  if (settings.typography) {
    for (const [key, value] of Object.entries(settings.typography)) {
      cssVars.push(`  --font-${key}: ${value};`);
    }
  }

  // Radii
  if (settings.radii) {
    for (const [key, value] of Object.entries(settings.radii)) {
      cssVars.push(`  --radius-${key}: ${value};`);
    }
  }

  // Shadows
  if (settings.shadows) {
    for (const [key, value] of Object.entries(settings.shadows)) {
      cssVars.push(`  --shadow-${key}: ${value};`);
    }
  }

  // Layout
  if (settings.layout) {
    for (const [key, value] of Object.entries(settings.layout)) {
      cssVars.push(`  --${key}: ${value};`);
    }
  }

  if (cssVars.length === 0) {
    return "";
  }

  return `:root {\n${cssVars.join("\n")}\n}`;
}
