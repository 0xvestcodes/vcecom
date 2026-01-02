"use client";

import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { MaintenanceToggle } from "./maintenance-toggle";

/**
 * Maintenance Settings Client
 * Manage maintenance mode for the storefront
 */
export function MaintenanceSettingsClient() {
  return (
    <AdminPageLayout
      title="Maintenance Mode"
      description="Enable or disable maintenance mode for your storefront"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Maintenance" },
      ]}
    >
      <MaintenanceToggle />
    </AdminPageLayout>
  );
}
