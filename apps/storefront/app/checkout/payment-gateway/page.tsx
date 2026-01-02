import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentGatewayClient } from "./payment-gateway-client";

function PaymentGatewayLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Processing Payment</h1>
      <Card>
        <CardContent className="p-8">
          <div className="space-y-4">
            <div className="h-20 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function PaymentGatewayPage({
  searchParams,
}: {
  searchParams:
    | Promise<{ paymentIntentId?: string; session?: string; gateway?: string }>
    | { paymentIntentId?: string; session?: string; gateway?: string };
}) {
  // Handle both Promise and direct object (Next.js 14 vs 15)
  const resolvedSearchParams =
    searchParams instanceof Promise ? await searchParams : searchParams;
  const paymentIntentId = resolvedSearchParams.paymentIntentId;
  const checkoutSessionId = resolvedSearchParams.session;
  const paymentGateway = resolvedSearchParams.gateway as
    | "razorpay"
    | "cashfree"
    | undefined;

  if (!paymentIntentId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-destructive mb-4">Invalid payment intent</p>
            <p className="text-sm text-muted-foreground">
              No payment intent ID found in URL. Please start checkout from your
              cart.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!checkoutSessionId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-destructive mb-4">Invalid checkout session</p>
            <p className="text-sm text-muted-foreground">
              No checkout session ID found in URL. Please start checkout from
              your cart.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Suspense fallback={<PaymentGatewayLoading />}>
      <PaymentGatewayClient
        paymentIntentId={paymentIntentId}
        checkoutSessionId={checkoutSessionId}
        paymentGateway={paymentGateway}
      />
    </Suspense>
  );
}
