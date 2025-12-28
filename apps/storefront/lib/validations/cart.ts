import { z } from "zod";

/**
 * Cart validation schemas matching backend DTOs
 */

export const priceBreakdownSchema = z.object({
  unitPrice: z.number(),
  lineTotal: z.number(),
  basePrice: z.number(),
  compareAtPrice: z.number().nullable(),
  breakdown: z.object({
    salePrice: z
      .object({
        amount: z.number(),
        label: z.string(),
      })
      .optional(),
    priceListDiscount: z
      .object({
        amount: z.number(),
        listName: z.string(),
      })
      .optional(),
    savings: z.number(),
    savingsPercentage: z.number(),
  }),
});

export const bundleVariantBreakdownSchema = z.object({
  variantId: z.string().uuid(),
  unitPrice: z.number(),
  quantity: z.number(),
});

export const enrichedCartItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["variant", "bundle"]),
  quantity: z.number(),

  // IDs
  variantId: z.string().uuid(),
  productId: z.string().uuid(),

  // Product details
  productTitle: z.string(),
  productSlug: z.string(),
  variantTitle: z.string().nullable(),
  sku: z.string(),
  attributes: z.record(z.string(), z.string()),

  // Images
  thumbnail: z.string().url().nullable(),

  // Pricing
  pricing: priceBreakdownSchema,

  // Inventory
  inventoryStatus: z.enum(["in_stock", "low_stock", "out_of_stock"]),
  availableQuantity: z.number(),

  // Tax
  gstRate: z.number(),

  // Bundle (optional)
  bundleId: z.string().uuid().optional(),
  bundleTitle: z.string().optional(),
  bundleSetId: z.string().uuid().optional(),
  selections: z.record(z.string(), z.array(z.string())).optional(),
  bundleVariantBreakdown: z.array(bundleVariantBreakdownSchema).optional(),

  // State
  state: z.enum(["fresh", "stale", "reacquired", "committed"]).optional(),
  isStale: z.boolean().optional(),

  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
});

export const gstBreakdownSchema = z.object({
  cgst: z.number(),
  sgst: z.number(),
  igst: z.number(),
  totalGst: z.number(),
  isIntraState: z.boolean(),
});

export const cartDiscountSchema = z.object({
  code: z.string(),
  type: z.enum(["percentage", "fixed", "buy_x_get_y"]),
  description: z.string(),
  amountSaved: z.number(),
  percentageSaved: z.number(),
  appliedTo: z.enum(["cart", "shipping", "items"]),
  eligibleItems: z.array(z.string().uuid()).optional(),
});

export const priceSummarySchema = z.object({
  subtotal: z.number(),
  itemDiscounts: z.number(),
  couponDiscount: z.number(),
  totalBeforeGst: z.number(),
  gstAmount: z.number(),
  gstBreakdown: gstBreakdownSchema,
  total: z.number(),
});

export const cartWarningSchema = z.object({
  type: z.string(),
  variantId: z.string().uuid().optional(),
  message: z.string(),
});

export const cartSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
  sessionId: z.string().nullable(),
  subtotal: z.number(),
  gstAmount: z.number(),
  discountCode: z.string().nullable(),
  discountAmount: z.number(),
  gstBreakdown: gstBreakdownSchema,
  total: z.number(),
  items: z.array(enrichedCartItemSchema),
  discount: cartDiscountSchema.optional(),
  priceSummary: priceSummarySchema,
  warnings: z.array(cartWarningSchema).optional(),
  expiresAt: z.string().datetime().or(z.date()).nullable(),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
  shippingCost: z.number().optional(),
  paymentFee: z.number().optional(),
});

export type Cart = z.infer<typeof cartSchema>;
export type CartItem = z.infer<typeof enrichedCartItemSchema>;
export type PriceBreakdown = z.infer<typeof priceBreakdownSchema>;
export type GstBreakdown = z.infer<typeof gstBreakdownSchema>;
export type CartDiscount = z.infer<typeof cartDiscountSchema>;
export type PriceSummary = z.infer<typeof priceSummarySchema>;
