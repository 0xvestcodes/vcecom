"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { del, endpoints, get, post, put } from "@/lib/api/client";
import { cartSchema } from "@/lib/validations/cart";

/**
 * Get cart
 */
export function useCart() {
  return useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const data = await get(endpoints.cart.get);
      return cartSchema.parse(data);
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Add item to cart
 */
export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      type?: "variant" | "bundle";
      productVariantId?: string;
      bundleId?: string;
      selections?: Record<string, string[]>;
      quantity: number;
    }) => {
      const data = await post(endpoints.cart.addItem, {
        type: input.type || "variant",
        productVariantId: input.productVariantId,
        bundleId: input.bundleId,
        selections: input.selections,
        quantity: input.quantity,
      });
      return cartSchema.parse(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["cart"], data);
      // Show warning if present
      if (data.warnings && data.warnings.length > 0) {
        const warningMessages = data.warnings.map((w) => w.message).join(" ");
        toast.warning(warningMessages, { duration: 5000 });
      } else {
      toast.success("Item added to cart");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add item to cart");
    },
  });
}

/**
 * Update cart item quantity
 */
export function useUpdateCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      quantity,
    }: {
      itemId: string;
      quantity: number;
    }) => {
      const data = await put(endpoints.cart.updateItem(itemId), { quantity });
      return cartSchema.parse(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["cart"], data);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update cart item");
    },
  });
}

/**
 * Remove item from cart
 */
export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const data = await del(endpoints.cart.removeItem(itemId));
      return cartSchema.parse(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["cart"], data);
      toast.success("Item removed from cart");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove item");
    },
  });
}

/**
 * Clear cart
 */
export function useClearCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await del(endpoints.cart.clear);
      return cartSchema.parse(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["cart"], data);
      toast.success("Cart cleared");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to clear cart");
    },
  });
}

/**
 * Apply coupon/discount code
 */
export function useApplyCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const data = await post(endpoints.cart.applyCoupon, { code });
      return cartSchema.parse(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["cart"], data);
      toast.success("Discount applied");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Invalid discount code");
    },
  });
}

/**
 * Remove coupon
 */
export function useRemoveCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await del(endpoints.cart.removeCoupon);
      return cartSchema.parse(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["cart"], data);
      toast.success("Discount removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove discount");
    },
  });
}
