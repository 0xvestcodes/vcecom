import { serverApiFetch } from "@/lib/server/api";
import { getCustomerSession } from "@/lib/server/auth";
import { HeaderClient } from "./header-client";

export async function Header() {
  const session = await getCustomerSession();

  // Fetch categories for navigation
  interface Category {
    id: string;
    name: string;
    slug?: string;
  }

  const categories = await serverApiFetch<Category[]>(
    "/store/categories",
  ).catch(() => []);

  return <HeaderClient categories={categories} isAuthenticated={!!session} />;
}
