"use server";

import { revalidatePath } from "next/cache";
import { serverApiFetch } from "@/lib/server/api";
import { getCustomerSession } from "@/lib/server/auth";
import { getOrCreateSessionId } from "@/lib/server/session";

export interface StartCheckoutData {
  shippingAddressId?: string;
  billingAddressId?: string;
}

export interface AddCheckoutAddressData {
  checkoutSessionId: string;
  type: "shipping" | "billing";
  address: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

/**
 * Start checkout session
 */
export async function startCheckout(
  formData: FormData,
): Promise<{ error?: string; checkoutSessionId?: string }> {
  const guestEmail = formData.get("guestEmail") as string | undefined;

  try {
    const session = await getCustomerSession();
    const sessionId = session ? null : await getOrCreateSessionId();

    const headers: HeadersInit = {};
    if (sessionId) {
      headers["X-Session-Id"] = sessionId;
    }

    // First, fetch the cart to get the cart ID
    const cart = await serverApiFetch<{ id: string }>("/store/cart", {
      headers,
    });

    if (!cart?.id) {
      return { error: "Cart is empty or invalid" };
    }

    // Start checkout with cart ID
    const data = await serverApiFetch<{ checkoutSessionId: string }>(
      "/store/checkout/start",
      {
        method: "POST",
        body: JSON.stringify({
          cartId: cart.id,
          ...(guestEmail && { guestEmail }),
        }),
        headers,
      },
    );

    revalidatePath("/checkout");
    return { checkoutSessionId: data.checkoutSessionId };
  } catch (error) {
    console.error("Start checkout error:", error);
    return {
      error: "Failed to start checkout. Please try again.",
    };
  }
}

/**
 * Add address to checkout session
 */
export async function addCheckoutAddress(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const checkoutSessionId = formData.get("checkoutSessionId") as string;
  const name = formData.get("name") as string;
  const formEmail = formData.get("email") as string | undefined;
  const phone = formData.get("phone") as string;
  const addressLine1 = formData.get("addressLine1") as string;
  const addressLine2 = formData.get("addressLine2") as string | undefined;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const postalCode = formData.get("postalCode") as string;
  const country = (formData.get("country") as string) || "India";

  try {
    const session = await getCustomerSession();
    const sessionId = session ? null : await getOrCreateSessionId();

    // Get email from form or session (session email takes precedence for authenticated users)
    const email = session?.email || formEmail;

    if (
      !checkoutSessionId ||
      !name ||
      !email ||
      !phone ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode
    ) {
      return {
        error: "Missing required fields. Email is required for checkout.",
      };
    }

    const headers: HeadersInit = {};
    if (sessionId) {
      headers["X-Session-Id"] = sessionId;
    }

    // Backend expects flat structure with specific field names
    await serverApiFetch("/store/checkout/address", {
      method: "POST",
      body: JSON.stringify({
        checkoutSessionId,
        name,
        email,
        phone,
        address1: addressLine1,
        ...(addressLine2 && { address2: addressLine2 }),
        city,
        state,
        pincode: postalCode,
        country,
      }),
      headers,
    });

    revalidatePath("/checkout");
    return { success: true };
  } catch (error) {
    console.error("Add checkout address error:", error);
    return {
      error: "Failed to add address. Please try again.",
    };
  }
}
