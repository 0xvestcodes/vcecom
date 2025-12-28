"use server";

/**
 * Server Actions for Cart
 */

import { cartSchema } from "../validations/cart";
import { serverApiClient } from "./utils";

/**
 * Get cart
 * @param checkoutSessionId - Optional checkout session ID to include shipping cost and payment fee
 */
export async function getCart(checkoutSessionId?: string) {
  try {
    const url = checkoutSessionId
      ? `/store/cart?checkoutSessionId=${checkoutSessionId}`
      : "/store/cart";
    const data = await serverApiClient<unknown>(url);
    return cartSchema.parse(data);
  } catch (error) {
    console.error("Failed to fetch cart:", error);
    return null;
  }
}
