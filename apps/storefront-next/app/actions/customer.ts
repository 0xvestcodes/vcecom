"use server";

import { revalidatePath } from "next/cache";
import { serverApiFetch } from "@/lib/server/api";

/**
 * Update customer profile
 */
export async function updateProfile(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const name = formData.get("name") as string | undefined;
  const phone = formData.get("phone") as string | undefined;

  try {
    await serverApiFetch("/store/customers/me", {
      method: "PATCH",
      body: JSON.stringify({ name, phone }),
    });

    revalidatePath("/account/profile");
    return { success: true };
  } catch (error) {
    console.error("Update profile error:", error);
    return {
      error: "Failed to update profile. Please try again.",
    };
  }
}

/**
 * Add customer address
 */
export async function addAddress(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const addressLine1 = formData.get("addressLine1") as string;
  const addressLine2 = formData.get("addressLine2") as string | undefined;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const postalCode = formData.get("postalCode") as string;
  const country = formData.get("country") as string;

  if (!name || !phone || !addressLine1 || !city || !state || !postalCode) {
    return { error: "Missing required fields" };
  }

  try {
    await serverApiFetch("/store/customers/addresses", {
      method: "POST",
      body: JSON.stringify({
        name,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
      }),
    });

    revalidatePath("/account/addresses");
    return { success: true };
  } catch (error) {
    console.error("Add address error:", error);
    return {
      error: "Failed to add address. Please try again.",
    };
  }
}

/**
 * Update customer address
 */
export async function updateAddress(
  addressId: string,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const addressLine1 = formData.get("addressLine1") as string;
  const addressLine2 = formData.get("addressLine2") as string | undefined;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const postalCode = formData.get("postalCode") as string;
  const country = formData.get("country") as string;

  if (!name || !phone || !addressLine1 || !city || !state || !postalCode) {
    return { error: "Missing required fields" };
  }

  try {
    await serverApiFetch(`/store/customers/addresses/${addressId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
      }),
    });

    revalidatePath("/account/addresses");
    return { success: true };
  } catch (error) {
    console.error("Update address error:", error);
    return {
      error: "Failed to update address. Please try again.",
    };
  }
}

/**
 * Delete customer address
 */
export async function deleteAddress(
  addressId: string,
): Promise<{ error?: string; success?: boolean }> {
  try {
    await serverApiFetch(`/store/customers/addresses/${addressId}`, {
      method: "DELETE",
    });

    revalidatePath("/account/addresses");
    return { success: true };
  } catch (error) {
    console.error("Delete address error:", error);
    return {
      error: "Failed to delete address. Please try again.",
    };
  }
}
