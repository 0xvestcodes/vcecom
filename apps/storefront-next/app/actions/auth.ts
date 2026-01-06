"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FetchError, serverApiFetch } from "@/lib/server/api";

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

export interface AuthError {
  message: string;
  errors?: Record<string, string[]>;
}

/**
 * Login action using Server Action
 */
export async function login(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await serverApiFetch("/store/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    // Revalidate and redirect
    revalidatePath("/");
    redirect("/");
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof FetchError) {
      return {
        error: error.message || "Login failed. Please check your credentials.",
      };
    }
    return {
      error: "An error occurred during login. Please try again.",
    };
  }
}

/**
 * Register action using Server Action
 */
export async function register(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string | undefined;
  const phone = formData.get("phone") as string | undefined;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await serverApiFetch("/store/customers/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name, phone }),
    });

    // Revalidate and redirect
    revalidatePath("/");
    redirect("/");
  } catch (error) {
    console.error("Register error:", error);
    if (error instanceof FetchError) {
      return {
        error: error.message || "Registration failed. Please try again.",
      };
    }
    return {
      error: "An error occurred during registration. Please try again.",
    };
  }
}

/**
 * Logout action using Server Action
 */
export async function logout(): Promise<void> {
  try {
    await serverApiFetch("/store/auth/logout", {
      method: "POST",
    });

    revalidatePath("/");
    redirect("/");
  } catch (error) {
    console.error("Logout error:", error);
    redirect("/");
  }
}
