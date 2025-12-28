import { z } from "zod";

/**
 * Order validation schemas matching backend DTOs
 */

export const pricingSnapshotSchema = z.object({
  basePrice: z.number(),
  compareAtPrice: z.number().nullable(),
  appliedSale: z
    .object({
      amount: z.number(),
      label: z.string(),
    })
    .optional(),
  appliedPriceList: z
    .object({
      name: z.string(),
      amount: z.number(),
    })
    .optional(),
  savings: z.number(),
});

export const orderItemGstBreakdownSchema = z.object({
  cgst: z.number(),
  sgst: z.number(),
  igst: z.number(),
});

export const enrichedOrderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  variantId: z.string().uuid(),
  productId: z.string().uuid(),
  productTitle: z.string(),
  productSlug: z.string(),
  variantTitle: z.string().nullable(),
  sku: z.string(),
  attributes: z.record(z.string(), z.string()),
  thumbnail: z.string().url().nullable(),
  quantity: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  pricingSnapshot: pricingSnapshotSchema.optional(),
  gstRate: z.number(),
  gstAmount: z.number(),
  gstBreakdown: orderItemGstBreakdownSchema,
  bundleId: z.string().uuid().optional(),
  bundleTitle: z.string().optional(),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
});

// Legacy order item schema for backward compatibility
export const orderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  productVariantId: z.string().uuid(),
  productTitle: z.string(),
  variantTitle: z.string().nullable(),
  sku: z.string().nullable(),
  quantity: z.number(),
  price: z.number(),
  gstRate: z.number(),
  gstAmount: z.number(),
  total: z.number(),
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

export const paymentFeeBreakdownSchema = z
  .object({
    method: z.string(),
    chargeType: z.string(),
    calculatedFee: z.number(),
    flatAmount: z.number().optional(),
    percentage: z.number().optional(),
    mixMin: z.number().optional(),
    mixCap: z.number().optional(),
  })
  .nullable()
  .optional();

export const addressSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
  phone: z.string(),
});

export const paymentDetailsSchema = z.object({
  method: z.string(),
  status: z.enum(["pending", "paid", "failed", "refunded"]),
  transactionId: z.string().nullable(),
  paidAt: z.string().datetime().or(z.date()).nullable(),
  feeBreakdown: z.object({
    chargeType: z.string(),
    amount: z.number(),
    percentage: z.number().optional(),
  }),
});

export const shippingDetailsSchema = z
  .object({
    provider: z.string().nullable(),
    method: z.string().nullable(),
    trackingNumber: z.string().nullable(),
    trackingUrl: z.string().url().nullable(),
    estimatedDelivery: z.string().datetime().or(z.date()).nullable(),
    shippedAt: z.string().datetime().or(z.date()).nullable(),
    deliveredAt: z.string().datetime().or(z.date()).nullable(),
  })
  .optional();

export const orderSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  orderNumber: z.string(),
  status: z.enum([
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ]),
  subtotal: z.number(),
  gstAmount: z.number(),
  gstBreakdown: gstBreakdownSchema,
  shippingCost: z.number(),
  paymentFee: z.number().optional(),
  paymentMethod: z.string().nullable().optional(),
  paymentFeeBreakdown: paymentFeeBreakdownSchema,
  total: z.number(),
  razorpayOrderId: z.string().nullable(),
  shippingProvider: z.string().nullable(),
  shippingAddressId: z.string().uuid(),
  billingAddressId: z.string().uuid(),
  items: z.array(enrichedOrderItemSchema).or(z.array(orderItemSchema)), // Support both enriched and legacy
  shippingAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  paymentDetails: paymentDetailsSchema.optional(),
  shippingDetails: shippingDetailsSchema,
  discountCode: z.string().nullable().optional(),
  discountAmount: z.number().optional(),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
  archived: z.boolean().optional(),
  archivedAt: z.string().datetime().or(z.date()).nullable().optional(),
  archivedBy: z.string().uuid().nullable().optional(),
});

export const orderTimelineSchema = z.object({
  orderId: z.string().uuid(),
  events: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.string(),
      status: z.string().optional(),
      description: z.string(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      createdAt: z.string().datetime().or(z.date()),
    }),
  ),
});

export const orderTrackingSchema = z.object({
  orderId: z.string().uuid(),
  trackingNumber: z.string().nullable(),
  carrier: z.string().nullable(),
  status: z.string().nullable(),
  estimatedDelivery: z.string().datetime().or(z.date()).nullable(),
  trackingUrl: z.string().url().nullable(),
});

export type Order = z.infer<typeof orderSchema>;
export type OrderItem = z.infer<typeof enrichedOrderItemSchema>;
export type OrderTimeline = z.infer<typeof orderTimelineSchema>;
export type OrderTracking = z.infer<typeof orderTrackingSchema>;
export type Address = z.infer<typeof addressSchema>;
export type PaymentDetails = z.infer<typeof paymentDetailsSchema>;
export type ShippingDetails = z.infer<typeof shippingDetailsSchema>;
export type PricingSnapshot = z.infer<typeof pricingSnapshotSchema>;
