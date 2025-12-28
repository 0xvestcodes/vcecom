import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCart } from "@/lib/actions/cart";
import { CheckoutConfirmClient } from "./checkout-confirm-client";

async function CheckoutConfirmForm({
  checkoutSessionId,
}: {
  checkoutSessionId: string;
}) {
  const cart = await getCart(checkoutSessionId);

  return (
    <CheckoutConfirmClient checkoutSessionId={checkoutSessionId} cart={cart} />
  );
}

function CheckoutConfirmLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Review Your Order</h1>
      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded" />
          </div>
          <div className="border-t pt-4 space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-6 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex gap-4 pt-4">
            <div className="h-10 bg-muted animate-pulse rounded flex-1" />
            <div className="h-10 bg-muted animate-pulse rounded flex-1" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function CheckoutConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }> | { session?: string };
}) {
  // Handle both Promise and direct object (Next.js 14 vs 15)
  const resolvedSearchParams =
    searchParams instanceof Promise ? await searchParams : searchParams;
  const checkoutSessionId = resolvedSearchParams.session;

  if (!checkoutSessionId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-destructive mb-4">Invalid checkout session</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Suspense fallback={<CheckoutConfirmLoading />}>
      <CheckoutConfirmForm checkoutSessionId={checkoutSessionId} />
    </Suspense>
  );
}
