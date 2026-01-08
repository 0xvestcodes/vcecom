"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { CreateProductInput, Product } from "@/lib/types/products";
import { useApiMutation } from "../use-api-mutation";

/**
 * Hook for creating a new product
 *
 * Handles product creation, cache invalidation, and navigation.
 * Shows success/error toasts and redirects to the new product page on success.
 *
 * @returns Mutation object with mutate and mutateAsync functions
 *
 * @example
 * ```tsx
 * const createProduct = useAdminCreateProduct();
 *
 * await createProduct.mutateAsync({
 *   title: "New Product",
 *   price: 99.99,
 *   // ... other fields
 * });
 * ```
 */
interface UseAdminCreateProductOptions {
  skipSuccessToast?: boolean;
  skipNavigation?: boolean;
}

export function useAdminCreateProduct(options?: UseAdminCreateProductOptions) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { skipSuccessToast = false, skipNavigation = false } = options || {};

  return useApiMutation<Product, CreateProductInput>({
    mutationFn: async (data) => {
      return api.post<Product>(endpoints.products.create, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [endpoints.products.list] });
      if (!skipSuccessToast) {
        toast.success("Product created successfully");
      }
      if (!skipNavigation) {
        router.push(`/products/${data.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create product");
    },
  });
}
