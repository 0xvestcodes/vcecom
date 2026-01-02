"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import type { ThemeSettingsDto } from "@/lib/types/themes";
import { ThemeCustomizer } from "./theme-customizer";
import { ThemePreview } from "./theme-preview";

interface ThemeCustomizerPageClientProps {
  themeId: string;
}

/**
 * Theme customizer page client
 * 3-pane layout: Settings (left), Preview (middle), Additional controls (right)
 */
export function ThemeCustomizerPageClient({
  themeId,
}: ThemeCustomizerPageClientProps) {
  const [settings, setSettings] = useState<ThemeSettingsDto>({});
  const [previewToken] = useState<string>(
    () => `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  );

  const handleSettingsChange = useCallback((newSettings: ThemeSettingsDto) => {
    setSettings(newSettings);
  }, []);

  return (
    <AdminPageLayout
      title={`Customize Theme: ${themeId}`}
      description="Customize your theme settings with live preview"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Themes", href: "/cms/themes" },
        { label: "Customize" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/cms/themes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
        {/* Left Pane: Theme Settings */}
        <div className="col-span-4 border-r">
          <ThemeCustomizer
            themeId={themeId}
            onSettingsChange={handleSettingsChange}
          />
        </div>

        {/* Middle Pane: Live Preview */}
        <div className="col-span-8">
          <ThemePreview
            themeId={themeId}
            settings={settings}
            previewToken={previewToken}
          />
        </div>
      </div>
    </AdminPageLayout>
  );
}
