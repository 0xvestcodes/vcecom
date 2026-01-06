"use server";

import { revalidatePath } from "next/cache";
import { serverApiFetch } from "@/lib/server/api";

/**
 * Get customer orders
 */
export async function getOrders(
  page: number = 1,
  limit: number = 10,
): Promise<unknown> {
  try {
    return await serverApiFetch("/store/orders", {
      params: { page, limit },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    throw error;
  }
}

/**
 * Get order by ID
 */
export async function getOrder(id: string): Promise<unknown> {
  try {
    const order = await serverApiFetch(`/store/orders/${id}`);
    revalidatePath(`/account/orders/${id}`);
    return order;
  } catch (error) {
    console.error("Get order error:", error);
    throw error;
  }
}

/**
 * Get available payment methods for checkout
 */
export async function getPaymentMethods(checkoutSessionId: string): Promise<{
  methods: Array<{
    method: string;
    label: string;
    fee: number;
    available: boolean;
    unavailableReason?: string;
  }>;
}> {
  try {
    const data = await serverApiFetch<{
      methods: Array<{
        method: string;
        label: string;
        fee: number;
        available: boolean;
        unavailableReason?: string;
      }>;
    }>(
      `/store/checkout/payment-methods?checkoutSessionId=${checkoutSessionId}`,
    );
    return data;
  } catch (error) {
    console.error("Get payment methods error:", error);
    return { methods: [] };
  }
}

/**
 * Create order (payment intent)
 */
export async function createOrder(
  formData: FormData,
): Promise<{ error?: string; paymentIntentId?: string }> {
  const checkoutSessionId = formData.get("checkoutSessionId") as string;
  const paymentMethodId = formData.get("paymentMethodId") as string;

  if (!checkoutSessionId) {
    return { error: "Checkout session ID is required" };
  }

  if (!paymentMethodId) {
    return { error: "Payment method is required" };
  }

  try {
    const data = await serverApiFetch<{ paymentIntentId: string }>(
      "/store/orders",
      {
        method: "POST",
        body: JSON.stringify({
          checkoutSessionId,
          paymentMethodId,
        }),
      },
    );

    revalidatePath("/checkout");
    return { paymentIntentId: data.paymentIntentId };
  } catch (error) {
    console.error("Create order error:", error);
    return {
      error: "Failed to create order. Please try again.",
    };
  }
}
