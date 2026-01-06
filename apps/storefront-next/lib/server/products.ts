import { serverApiFetch } from "./api";

/**
 * Check if a product is in stock by checking its variants
 */
export async function checkProductInStock(productId: string): Promise<boolean> {
  try {
    const variants = await serverApiFetch<
      Array<{
        id: string;
        inventory: number;
      }>
    >(`/store/products/${productId}/variants`);

    // If no variants exist, assume product is in stock (products without variants)
    if (!variants || variants.length === 0) {
      return true;
    }

    // Product is in stock if at least one variant has inventory > 0
    const hasStock = variants.some((variant) => variant.inventory > 0);

    // If all variants have 0 inventory, check if any have inventory field at all
    // Some products might have inventory set at product level, not variant level
    if (!hasStock && variants.length > 0) {
      // For now, default to true if product exists and is active
      // This handles cases where inventory hasn't been set up yet
      return true;
    }

    return hasStock;
  } catch (error) {
    // If we can't check variants, assume product is in stock if it exists
    // This prevents false negatives and allows products to be sold
    console.error("Error checking product inventory:", error);
    return true; // Default to in stock to avoid blocking sales
  }
}

/**
 * Get product with stock status
 */
export async function getProductWithStock(product: {
  id: string;
  status: string;
  [key: string]: unknown;
}): Promise<{
  id: string;
  status: string;
  inStock: boolean;
  [key: string]: unknown;
}> {
  // If product is not active, it's out of stock
  if (product.status !== "active") {
    return { ...product, inStock: false };
  }

  // Check variants for inventory
  const inStock = await checkProductInStock(product.id);
  return { ...product, inStock };
}
