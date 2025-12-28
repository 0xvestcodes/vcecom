"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { endpoints, get } from "@/lib/api/client";

/**
 * Schema for variant inventory response
 */
const variantInventorySchema = z.object({
  variantId: z.string().uuid(),
  available: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type VariantInventory = z.infer<typeof variantInventorySchema>;

/**
 * Live inventory polling hook for a single variant
 * Polls every 5 seconds for real-time inventory updates
 *
 * @param variantId - Variant ID to poll inventory for
 * @param enabled - Whether polling should be enabled (default: true)
 * @param pollInterval - Polling interval in milliseconds (default: 5000)
 * @returns Query result with inventory data, loading state, and error state
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useVariantInventory(variantId);
 * if (data) {
 *   console.log(`Available: ${data.available}, Reserved: ${data.reserved}`);
 * }
 * ```
 */
export function useVariantInventory(
  variantId: string | null | undefined,
  enabled: boolean = true,
  pollInterval: number = 5000,
) {
  return useQuery({
    queryKey: ["variant-inventory", variantId],
    queryFn: async () => {
      if (!variantId) {
        throw new Error("Variant ID is required");
      }
      const url = endpoints.products.variantInventory(variantId);
      const data = await get(url);
      return variantInventorySchema.parse(data);
    },
    enabled: enabled && !!variantId,
    refetchInterval: pollInterval, // Poll every 5 seconds by default
    staleTime: 0, // Always consider data stale to ensure fresh polling
    gcTime: 10000, // Keep in cache for 10 seconds after unmount
  });
}

/**
 * Live inventory polling hook for multiple variants
 * Polls every 5 seconds for real-time inventory updates
 *
 * @param variantIds - Array of variant IDs to poll inventory for
 * @param enabled - Whether polling should be enabled (default: true)
 * @param pollInterval - Polling interval in milliseconds (default: 5000)
 * @returns Query result with inventory data map, loading state, and error state
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useMultipleVariantInventory(["id1", "id2"]);
 * if (data) {
 *   console.log(`Variant 1 available: ${data["id1"]?.available}`);
 * }
 * ```
 */
export function useMultipleVariantInventory(
  variantIds: string[],
  enabled: boolean = true,
  pollInterval: number = 5000,
) {
  return useQuery({
    queryKey: ["variant-inventory", "multiple", variantIds.sort().join(",")],
    queryFn: async () => {
      if (!variantIds || variantIds.length === 0) {
        return {};
      }

      // Fetch all variants in parallel
      const inventoryPromises = variantIds.map(async (variantId) => {
        try {
          const url = endpoints.products.variantInventory(variantId);
          const data = await get(url);
          const parsed = variantInventorySchema.parse(data);
          return { variantId, inventory: parsed };
        } catch (error) {
          // Log error but don't fail entire query
          console.error(
            `Failed to fetch inventory for variant ${variantId}:`,
            error,
          );
          return { variantId, inventory: null };
        }
      });

      const results = await Promise.all(inventoryPromises);

      // Build map of variantId -> inventory
      const inventoryMap: Record<string, VariantInventory | null> = {};
      for (const result of results) {
        inventoryMap[result.variantId] = result.inventory;
      }

      return inventoryMap;
    },
    enabled: enabled && variantIds.length > 0,
    refetchInterval: pollInterval, // Poll every 5 seconds by default
    staleTime: 0, // Always consider data stale to ensure fresh polling
    gcTime: 10000, // Keep in cache for 10 seconds after unmount
  });
}
