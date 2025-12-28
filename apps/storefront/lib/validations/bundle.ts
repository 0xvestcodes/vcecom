import { z } from "zod";

/**
 * Bundle validation schemas matching backend DTOs
 */

export const bundleSetItemSchema = z.object({
  id: z.string().uuid(),
  variantId: z.string().uuid(),
  productId: z.string().uuid(),
  productTitle: z.string(),
  productSlug: z.string(),
  variantTitle: z.string().nullable(),
  sku: z.string(),
  attributes: z.record(z.string(), z.string()),
  thumbnail: z.string().url().nullable(),
  basePrice: z.number(),
  compareAtPrice: z.number().nullable(),
  createdAt: z.string().datetime().or(z.date()),
});

export const bundleSetSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  minQuantity: z.number(),
  maxQuantity: z.number(),
  sortOrder: z.number(),
  items: z.array(bundleSetItemSchema),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
});

export const bundleSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  isActive: z.boolean(),
  allowMixAndMatch: z.boolean(),
  sets: z.array(bundleSetSchema),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
});

export const paginatedBundlesSchema = z.object({
  data: z.array(bundleSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export type Bundle = z.infer<typeof bundleSchema>;
export type BundleSet = z.infer<typeof bundleSetSchema>;
export type BundleSetItem = z.infer<typeof bundleSetItemSchema>;
export type PaginatedBundles = z.infer<typeof paginatedBundlesSchema>;
