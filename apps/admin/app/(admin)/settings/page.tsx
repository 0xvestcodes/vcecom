import { SettingsPageClient } from "@/components/settings/settings-page-client";

/**
 * Settings page - Server component
 * Delegates all client-side logic to SettingsPageClient component
 */
export default function SettingsPage() {
  return <SettingsPageClient />;
}
