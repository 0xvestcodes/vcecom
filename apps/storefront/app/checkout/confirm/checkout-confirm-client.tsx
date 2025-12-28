"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmCheckout } from "@/lib/actions/checkout";
import { isRedirectError } from "@/lib/utils/redirect-error";
import type { Cart } from "@/lib/validations/cart";

interface CheckoutConfirmClientProps {
  checkoutSessionId: string;
  cart: Cart | null;
}

export function CheckoutConfirmClient({
  checkoutSessionId,
  cart,
}: CheckoutConfirmClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    if (!checkoutSessionId) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("checkoutSessionId", checkoutSessionId);

        await confirmCheckout(formData);
        // Server action handles redirect via redirect() call
      } catch (error) {
        // Re-throw redirect errors - Next.js needs these to perform navigation
        if (isRedirectError(error)) {
          throw error;
        }

        // Only handle actual errors, not redirects
        const errorMessage = encodeURIComponent(
          error instanceof Error ? error.message : "Failed to place order",
        );
        router.push(`/checkout/error?message=${errorMessage}`);
      }
    });
  };

  if (!cart) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Loading order summary...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Review Your Order</h1>

      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Order Items */}
          <div className="space-y-2">
            <h3 className="font-semibold">Items</h3>
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.quantity}x {item.productTitle}
                  {item.variantTitle && ` - ${item.variantTitle}`}
                </span>
                <span>₹{item.pricing.lineTotal.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{cart.subtotal.toFixed(2)}</span>
            </div>

            {cart.discountCode && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({cart.discountCode})</span>
                <span>-₹{cart.discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>GST</span>
              <span>₹{cart.gstAmount.toFixed(2)}</span>
            </div>

            {cart.shippingCost && cart.shippingCost > 0 && (
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>₹{cart.shippingCost.toFixed(2)}</span>
              </div>
            )}

            {cart.paymentFee && cart.paymentFee > 0 && (
              <div className="flex justify-between">
                <span>Payment Fee</span>
                <span>₹{(cart.paymentFee / 100).toFixed(2)}</span>
              </div>
            )}

            <div className="border-t pt-4 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>
                ₹
                {(
                  cart.total +
                  (cart.shippingCost || 0) +
                  (cart.paymentFee || 0) / 100
                ).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/checkout/payment?session=${checkoutSessionId}`)
              }
              disabled={isPending}
            >
              Back
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-1"
              size="lg"
            >
              {isPending ? "Placing Order..." : "Place Order"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
