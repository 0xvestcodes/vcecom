import { SearchSettingsClient } from "@/components/search/search-settings-client";

/**
 * Search settings page - Server component
 * Delegates all client-side logic to SearchSettingsClient component
 */
export default function SearchSettingsPage() {
  return <SearchSettingsClient />;
}
