import { CurrencySettingsRefactored } from "@/components/settings/currency-settings-refactored";

/**
 * Currency settings page - Server component
 * Delegates all client-side logic to CurrencySettingsRefactored component
 */
export default function CurrencyPage() {
  return <CurrencySettingsRefactored />;
}
