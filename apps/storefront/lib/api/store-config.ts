import { endpoints } from "@/lib/api/endpoints";
import {
  type StoreConfig,
  storeConfigSchema,
} from "@/lib/validations/store-config";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Fetch store configuration (server-side)
 */
export async function fetchStoreConfig(): Promise<StoreConfig | null> {
  try {
    const url = `${API_BASE_URL}${endpoints.config.store}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "force-cache",
      next: { revalidate: 600 }, // 10 minutes cache
    });

    if (!response.ok) {
      console.error(`Failed to fetch store config: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return storeConfigSchema.parse(data);
  } catch (error) {
    console.error("Error fetching store config:", error);
    return null;
  }
}
