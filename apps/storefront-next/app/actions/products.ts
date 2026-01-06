"use server";

import { serverApiFetch } from "@/lib/server/api";

export interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: "draft" | "active" | "archived";
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: "price" | "name" | "date";
  sortOrder?: "asc" | "desc";
}

/**
 * Search products
 */
export async function searchProducts(
  filters: ProductFilters = {},
): Promise<unknown> {
  try {
    const params: Record<string, string> = {};
    if (filters.page) params.page = String(filters.page);
    if (filters.limit) params.limit = String(filters.limit);
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.categoryId) params.categoryId = filters.categoryId;
    if (filters.minPrice) params.minPrice = String(filters.minPrice);
    if (filters.maxPrice) params.maxPrice = String(filters.maxPrice);
    if (filters.inStock !== undefined) params.inStock = String(filters.inStock);
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;

    return await serverApiFetch("/store/products", {
      params,
    });
  } catch (error) {
    console.error("Search products error:", error);
    throw error;
  }
}

/**
 * Get product by ID
 */
export async function getProduct(id: string): Promise<unknown> {
  try {
    return await serverApiFetch(`/store/products/${id}`);
  } catch (error) {
    console.error("Get product error:", error);
    throw error;
  }
}
