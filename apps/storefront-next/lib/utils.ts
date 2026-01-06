import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  value: number,
  currency: string = "INR",
): string {
  // Get currency info from localStorage or use default
  const selectedCurrency =
    typeof window !== "undefined"
      ? localStorage.getItem("storefront_currency") || currency
      : currency;

  // Determine locale based on currency
  const locale = selectedCurrency === "INR" ? "en-IN" : "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: selectedCurrency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}
