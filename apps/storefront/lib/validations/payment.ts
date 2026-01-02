import { z } from "zod";

/**
 * Payment validation schemas matching backend DTOs
 */

export const createRazorpayOrderSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().min(1),
  currency: z.string().default("INR"),
  receipt: z.string().optional(),
  paymentCapture: z.number().int().min(0).max(1).default(1),
  notes: z.record(z.string(), z.string()).optional(),
});

export const razorpayOrderResponseSchema = z.object({
  id: z.string(),
  entity: z.string(),
  amount: z.number(),
  amount_paid: z.number(),
  amount_due: z.number(),
  currency: z.string(),
  receipt: z.string().nullable(),
  status: z.string(),
  attempts: z.number(),
  notes: z.record(z.string(), z.string()).nullable(),
  created_at: z.number(),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const paymentVerificationResponseSchema = z.object({
  verified: z.boolean(),
  message: z.string(),
  payment: z
    .object({
      id: z.string(),
      orderId: z.string(),
      amount: z.number(),
      status: z.string(),
      method: z.string(),
    })
    .optional(),
});

export const createCashfreeOrderSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().min(1),
  currency: z.string().default("INR"),
  customer: z
    .object({
      customerId: z.string().optional(),
      customerName: z.string().optional(),
      customerEmail: z.string().email().optional(),
      customerPhone: z.string().optional(),
    })
    .optional(),
  returnUrl: z.string().url().optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

export const cashfreeOrderResponseSchema = z.object({
  orderId: z.string(),
  paymentSessionId: z.string(),
  orderToken: z.string(),
  orderAmount: z.number(),
  orderCurrency: z.string(),
  orderStatus: z.string(),
  paymentLink: z.string().optional(),
});

export const verifyCashfreePaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export const cashfreePaymentVerificationResponseSchema = z.object({
  verified: z.boolean(),
  message: z.string(),
  payment: z
    .object({
      id: z.string(),
      orderId: z.string(),
      amount: z.number(),
      status: z.string(),
      method: z.string(),
    })
    .optional(),
});

export type CreateRazorpayOrderInput = z.infer<
  typeof createRazorpayOrderSchema
>;
export type RazorpayOrderResponse = z.infer<typeof razorpayOrderResponseSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type PaymentVerificationResponse = z.infer<
  typeof paymentVerificationResponseSchema
>;
export type CreateCashfreeOrderInput = z.infer<
  typeof createCashfreeOrderSchema
>;
export type CashfreeOrderResponse = z.infer<typeof cashfreeOrderResponseSchema>;
export type VerifyCashfreePaymentInput = z.infer<
  typeof verifyCashfreePaymentSchema
>;
export type CashfreePaymentVerificationResponse = z.infer<
  typeof cashfreePaymentVerificationResponseSchema
>;
