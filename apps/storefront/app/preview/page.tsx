import { ThemeFooter } from "@/components/cms/theme-footer";
import { ThemeHeader } from "@/components/cms/theme-header";
import { ThemeStyles } from "@/components/theme/theme-styles";
import type { Footer, Navigation } from "@/content-schema";
import { fetchStoreConfig } from "@/lib/api/store-config";
import { getAllContent } from "@/lib/content/content";

interface PreviewPageProps {
  searchParams: Promise<{
    theme?: string;
    preview?: string;
    previewToken?: string;
  }>;
}

/**
 * Preview page for theme customizer
 * Handles preview tokens and theme parameters from query string
 */
export default async function PreviewPage({ searchParams }: PreviewPageProps) {
  const params = await searchParams;
  const themeId = params?.theme;
  const isPreview = params?.preview === "true";
  const previewToken = params?.previewToken;

  // Fetch store config
  const storeConfig = await fetchStoreConfig();

  // Fetch all content
  const contentResult = await getAllContent();
  const content = contentResult.data;

  // Get theme settings
  const themeSettings = content.theme_settings;

  // Generate theme CSS from settings
  const themeCSS =
    themeSettings && typeof themeSettings === "object"
      ? generateThemeCSSFromSettings(themeSettings)
      : "";

  return (
    <>
      {themeCSS && <ThemeStyles css={themeCSS} />}
      <ThemeHeader
        navigation={content.navigation as Navigation}
        storeConfig={storeConfig || undefined}
      />
      <main>
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-4">Theme Preview</h1>
          <p className="text-muted-foreground">
            This is a preview of your theme settings.
          </p>
          {isPreview && previewToken && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                Preview Mode: Active | Token: {previewToken.substring(0, 20)}...
              </p>
            </div>
          )}
        </div>
      </main>
      <ThemeFooter footer={content.footer as Footer} />
    </>
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
