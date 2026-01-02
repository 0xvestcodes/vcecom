"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { endpoints, post } from "@/lib/api/client";
import {
  type CreateCashfreeOrderInput,
  type CreateRazorpayOrderInput,
  cashfreeOrderResponseSchema,
  cashfreePaymentVerificationResponseSchema,
  createCashfreeOrderSchema,
  createRazorpayOrderSchema,
  paymentVerificationResponseSchema,
  razorpayOrderResponseSchema,
  type VerifyCashfreePaymentInput,
  type VerifyPaymentInput,
  verifyCashfreePaymentSchema,
  verifyPaymentSchema,
} from "@/lib/validations/payment";

/**
 * Create Razorpay order
 */
export function useCreateRazorpayOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRazorpayOrderInput) => {
      const validated = createRazorpayOrderSchema.parse(input);
      const data = await post(
        endpoints.payments.createRazorpayOrder,
        validated,
      );
      return razorpayOrderResponseSchema.parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create payment order");
    },
  });
}

/**
 * Verify Razorpay payment
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: VerifyPaymentInput) => {
      const validated = verifyPaymentSchema.parse(input);
      const data = await post(endpoints.payments.verifyPayment, validated);
      return paymentVerificationResponseSchema.parse(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (data.verified) {
        toast.success("Payment verified successfully");
      } else {
        toast.error("Payment verification failed");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Payment verification failed");
    },
  });
}

/**
 * Create Cashfree order
 */
export function useCreateCashfreeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCashfreeOrderInput) => {
      const validated = createCashfreeOrderSchema.parse(input);
      const data = await post(
        endpoints.payments.createCashfreeOrder,
        validated,
      );
      return cashfreeOrderResponseSchema.parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create payment order");
    },
  });
}

/**
 * Verify Cashfree payment
 */
export function useVerifyCashfreePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: VerifyCashfreePaymentInput) => {
      const validated = verifyCashfreePaymentSchema.parse(input);
      const data = await post(
        endpoints.payments.verifyCashfreePayment,
        validated,
      );
      return cashfreePaymentVerificationResponseSchema.parse(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (data.verified) {
        toast.success("Payment verified successfully");
      } else {
        toast.error("Payment verification failed");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Payment verification failed");
    },
  });
}
