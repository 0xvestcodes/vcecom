"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useCreateCashfreeOrder,
  useVerifyCashfreePayment,
} from "@/hooks/use-payments";
import { get } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { getToken } from "@/lib/utils/storage";

interface CashfreePaymentClientProps {
  paymentIntentId: string;
  checkoutSessionId: string;
  orderId: string;
  amount: number;
}

declare global {
  interface Window {
    Cashfree: {
      checkout: (options: CashfreeCheckoutOptions) => void;
    };
  }
}

interface CashfreeCheckoutOptions {
  paymentSessionId: string;
  redirectTarget?: "_self" | "_blank";
}

interface CustomerPrefill {
  name?: string;
  email?: string;
  phone?: string;
}

export function CashfreePaymentClient({
  paymentIntentId,
  checkoutSessionId,
  orderId,
  amount,
}: CashfreePaymentClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customerPrefill, setCustomerPrefill] = useState<CustomerPrefill>({});
  const cashfreeLoaded = useRef(false);
  const createCashfreeOrderMutation = useCreateCashfreeOrder();
  const verifyCashfreePaymentMutation = useVerifyCashfreePayment();

  // Fetch customer details for Cashfree prefill
  const fetchCustomerPrefill = useCallback(async () => {
    try {
      const token = getToken();
      if (token) {
        try {
          const customerData = await get<{
            firstName?: string;
            lastName?: string;
            name?: string;
            email?: string;
            phone?: string;
          }>(endpoints.customers.me);
          if (customerData) {
            setCustomerPrefill({
              name:
                customerData.name ||
                (customerData.firstName
                  ? `${customerData.firstName}${customerData.lastName ? ` ${customerData.lastName}` : ""}`
                  : undefined),
              email: customerData.email || undefined,
              phone: customerData.phone || undefined,
            });
            return;
          }
        } catch (error) {
          console.log("Could not fetch customer from profile, trying cart");
        }
      }

      // Fallback: Try to get customer details from cart
      try {
        const cartData = await get<{
          customer?: {
            firstName?: string;
            lastName?: string;
            name?: string;
            email?: string;
            phone?: string;
          };
        }>(`${endpoints.cart.get}?checkoutSessionId=${checkoutSessionId}`);
        if (cartData?.customer) {
          const customer = cartData.customer;
          setCustomerPrefill({
            name:
              customer.name ||
              (customer.firstName
                ? `${customer.firstName}${customer.lastName ? ` ${customer.lastName}` : ""}`
                : undefined),
            email: customer.email || undefined,
            phone: customer.phone || undefined,
          });
        }
      } catch (error) {
        console.log("Could not fetch customer details for prefill");
      }
    } catch (error) {
      console.error("Error fetching customer prefill:", error);
    }
  }, [checkoutSessionId]);

  // Poll for order creation after payment
  const waitForOrderCreation = useCallback(async () => {
    const maxAttempts = 30;
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Try to get order by checkout session
        const orderData = await get<{ id: string }>(
          `${endpoints.orders.list}?checkoutSessionId=${checkoutSessionId}`,
        );

        if (orderData && "id" in orderData) {
          // Order found, redirect to order page
          router.push(`/orders/${orderData.id}`);
          return;
        }
      } catch (error) {
        // Continue polling even on error
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    // If we get here, order wasn't found after max attempts
    router.push(
      `/checkout/success?session=${checkoutSessionId}&message=${encodeURIComponent("Order is being processed. You will receive a confirmation email shortly.")}`,
    );
  }, [checkoutSessionId, router]);

  // Fetch customer prefill data on mount
  useEffect(() => {
    fetchCustomerPrefill();
  }, [fetchCustomerPrefill]);

  useEffect(() => {
    const cashfreeAppId = process.env.NEXT_PUBLIC_CASHFREE_APP_ID;

    if (!cashfreeAppId) {
      setError("Cashfree is not configured. Please contact support.");
      setIsLoading(false);
      return;
    }

    // Load Cashfree script
    const loadCashfreeScript = () => {
      if (cashfreeLoaded.current) {
        initializeCashfree();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.async = true;
      script.onload = () => {
        cashfreeLoaded.current = true;
        initializeCashfree();
      };
      script.onerror = () => {
        setError(
          "Failed to load Cashfree payment gateway. Please refresh the page and try again.",
        );
        setIsLoading(false);
      };
      document.body.appendChild(script);
    };

    const initializeCashfree = async () => {
      if (!window.Cashfree) {
        setError("Cashfree SDK not loaded. Please refresh the page.");
        setIsLoading(false);
        return;
      }

      try {
        // Create Cashfree order if paymentIntentId is not already a Cashfree order
        let paymentSessionId = paymentIntentId;

        // If paymentIntentId doesn't look like a Cashfree session ID, create a new order
        if (!paymentIntentId.startsWith("session_")) {
          const cashfreeOrder = await createCashfreeOrderMutation.mutateAsync({
            orderId,
            amount,
            currency: "INR",
            customer: {
              customerName: customerPrefill.name,
              customerEmail: customerPrefill.email,
              customerPhone: customerPrefill.phone,
            },
            returnUrl: `${window.location.origin}/checkout/payment/return?orderId=${orderId}`,
            notes: {
              checkout_session_id: checkoutSessionId,
            },
          });

          paymentSessionId = cashfreeOrder.paymentSessionId;
        }

        // Initialize Cashfree checkout
        window.Cashfree.checkout({
          paymentSessionId,
          redirectTarget: "_self",
        });

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initialize Cashfree:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to initialize payment gateway. Please try again.",
        );
        setIsLoading(false);
      }
    };

    loadCashfreeScript();
  }, [
    paymentIntentId,
    checkoutSessionId,
    orderId,
    amount,
    customerPrefill,
    createCashfreeOrderMutation,
  ]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing Payment</CardTitle>
          <CardDescription>
            Please wait while we initialize the payment gateway...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.reload()} className="w-full">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Cashfree checkout will redirect, so we don't need to render anything
  return (
    <Card>
      <CardHeader>
        <CardTitle>Redirecting to Payment Gateway</CardTitle>
        <CardDescription>
          You will be redirected to Cashfree to complete your payment...
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
