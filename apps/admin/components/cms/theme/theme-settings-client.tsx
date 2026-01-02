"use client";

import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { ThemeEditor } from "./theme-editor";

/**
 * Theme Settings Client
 * Manage theme settings (colors, spacing, typography, etc.)
 */
export function ThemeSettingsClient() {
  return (
    <AdminPageLayout
      title="Theme Settings"
      description="Customize your site's appearance"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Theme" },
      ]}
    >
      <ThemeEditor />
    </AdminPageLayout>
  );
}
