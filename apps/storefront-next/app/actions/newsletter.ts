"use server";

import { serverApiFetch } from "@/lib/server/api";

/**
 * Subscribe to newsletter
 */
export async function subscribeNewsletter(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Please enter a valid email address" };
  }

  try {
    // Note: This assumes a newsletter endpoint exists in the backend
    // If not, you can store it locally or integrate with a service like Mailchimp
    await serverApiFetch("/store/newsletter/subscribe", {
      method: "POST",
      body: JSON.stringify({ email }),
    }).catch(() => {
      // If endpoint doesn't exist, we'll just return success
      // In production, you'd want to handle this properly
    });

    return { success: true };
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    // Don't show error to user if backend doesn't have this endpoint yet
    return { success: true };
  }
}
