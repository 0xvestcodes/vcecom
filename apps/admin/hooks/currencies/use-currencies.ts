"use client";

import { endpoints } from "@/lib/endpoints";
import type { Currency } from "@/lib/types/currencies";
import { useApiQuery } from "../use-api-query";

/**
 * Hook for fetching all currencies
 */
export function useCurrencies() {
  return useApiQuery<Currency[]>(endpoints.currencies.list);
}

/**
 * Hook for fetching active currencies
 */
export function useActiveCurrencies() {
  return useApiQuery<Currency[]>(endpoints.currencies.active);
}

/**
 * Hook for fetching default currency
 */
export function useDefaultCurrency() {
  return useApiQuery<Currency | null>(endpoints.currencies.default);
}

/**
 * Hook for fetching a single currency by ID
 */
export function useCurrency(id: string) {
  return useApiQuery<Currency>(endpoints.currencies.detail(id), {
    enabled: !!id,
  });
}
