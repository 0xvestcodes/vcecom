"use server";

import { revalidatePath } from "next/cache";
import { serverApiFetch } from "@/lib/server/api";
import { getCustomerSession } from "@/lib/server/auth";
import { getOrCreateSessionId } from "@/lib/server/session";

export interface AddToCartData {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface UpdateCartItemData {
  quantity: number;
}

/**
 * Add item to cart
 * Supports both direct form action calls and useFormState hook
 */
export async function addToCart(
  prevStateOrFormData: unknown,
  formData?: FormData,
): Promise<{ error?: string; success?: boolean }> {
  // Handle both useFormState (formData is second arg) and direct form action (FormData is first arg)
  let data: FormData;

  if (prevStateOrFormData instanceof FormData) {
    // Direct form action call - FormData is the first argument
    data = prevStateOrFormData;
  } else if (formData instanceof FormData) {
    // useFormState hook - FormData is the second argument
    data = formData;
  } else {
    return { error: "Invalid form data" };
  }

  const productId = data.get("productId") as string;
  const variantId = data.get("variantId") as string | undefined;
  const quantity = parseInt(data.get("quantity") as string, 10) || 1;

  if (!productId) {
    return { error: "Product ID is required" };
  }

  try {
    // If variantId is provided, use it; otherwise fetch the first variant for the product
    let productVariantId = variantId;

    if (!productVariantId) {
      // Fetch product variants to get the first available variant
      const variants = await serverApiFetch<
        Array<{
          id: string;
          inventory: number;
        }>
      >(`/store/products/${productId}/variants`).catch(() => []);

      if (!variants || variants.length === 0) {
        return { error: "Product has no variants available" };
      }

      // Use the first variant with inventory > 0, or just the first variant
      const availableVariant =
        variants.find((v) => v.inventory > 0) || variants[0];
      productVariantId = availableVariant.id;
    }

    if (!productVariantId) {
      return { error: "Product variant is required" };
    }

    const session = await getCustomerSession();
    const sessionId = session ? null : await getOrCreateSessionId();

    const headers: HeadersInit = {};
    if (sessionId) {
      headers["X-Session-Id"] = sessionId;
    }

    await serverApiFetch("/store/cart/items", {
      method: "POST",
      body: JSON.stringify({
        type: "variant",
        productVariantId,
        quantity,
      }),
      headers,
    });

    revalidatePath("/cart");
    return { success: true };
  } catch (error) {
    console.error("Add to cart error:", error);
    return {
      error: "Failed to add item to cart. Please try again.",
    };
  }
}

/**
 * Update cart item quantity
 * Supports both direct calls and form actions
 */
export async function updateCartItem(
  itemIdOrFormData: string | FormData,
  quantityOrPrevState?: number | unknown,
  quantity?: number,
): Promise<{ error?: string; success?: boolean }> {
  let itemId: string;
  let newQuantity: number;

  // Handle form action call (FormData is first arg)
  if (itemIdOrFormData instanceof FormData) {
    itemId = itemIdOrFormData.get("itemId") as string;
    const qty = itemIdOrFormData.get("quantity");
    newQuantity = qty ? parseInt(qty as string, 10) : 1;
  } else {
    // Direct call
    itemId = itemIdOrFormData;
    newQuantity = quantity || (quantityOrPrevState as number) || 1;
  }

  if (!itemId) {
    return { error: "Item ID is required" };
  }

  if (newQuantity < 1) {
    return { error: "Quantity must be at least 1" };
  }

  try {
    const session = await getCustomerSession();
    const sessionId = session ? null : await getOrCreateSessionId();

    const headers: HeadersInit = {};
    if (sessionId) {
      headers["X-Session-Id"] = sessionId;
    }

    await serverApiFetch(`/store/cart/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({ quantity: newQuantity }),
      headers,
    });

    revalidatePath("/cart");
    return { success: true };
  } catch (error) {
    console.error("Update cart item error:", error);
    return {
      error: "Failed to update cart item. Please try again.",
    };
  }
}

/**
 * Remove item from cart
 * Supports both direct calls and form actions
 */
export async function removeCartItem(
  itemIdOrFormData: string | FormData,
): Promise<{ error?: string; success?: boolean }> {
  let itemId: string;

  // Handle form action call (FormData is first arg)
  if (itemIdOrFormData instanceof FormData) {
    itemId = itemIdOrFormData.get("itemId") as string;
  } else {
    // Direct call
    itemId = itemIdOrFormData;
  }

  if (!itemId) {
    return { error: "Item ID is required" };
  }

  try {
    const session = await getCustomerSession();
    const sessionId = session ? null : await getOrCreateSessionId();

    const headers: HeadersInit = {};
    if (sessionId) {
      headers["X-Session-Id"] = sessionId;
    }

    await serverApiFetch(`/store/cart/items/${itemId}`, {
      method: "DELETE",
      headers,
    });

    revalidatePath("/cart");
    return { success: true };
  } catch (error) {
    console.error("Remove cart item error:", error);
    return {
      error: "Failed to remove item from cart. Please try again.",
    };
  }
}
