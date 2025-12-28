import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthToken, serverApiClient } from "@/lib/actions/utils";
import { isRedirectError } from "@/lib/utils/redirect-error";
import { orderSchema } from "@/lib/validations/order";

async function OrderConfirmationContent({ orderId }: { orderId: string }) {
  // Try to fetch order - if user is logged in, use authenticated endpoint
  // If not logged in, we'll show a simple confirmation page
  const token = await getAuthToken();
  let order = null;

  if (token) {
    // User is logged in - fetch full order details
    try {
      const data = await serverApiClient<unknown>(`/store/orders/${orderId}`);
      order = orderSchema.parse(data);
    } catch (error) {
      // If error, fall through to simple confirmation
      console.error("Failed to fetch order:", error);
    }
  }

  // If we have full order data, show detailed view
  if (order) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="Order confirmed checkmark"
            >
              <title>Order confirmed checkmark</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Order Placed Successfully!
          </h1>
          <p className="text-muted-foreground">
            Your order has been confirmed and we've sent you a confirmation
            email.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order {order.orderNumber}</CardTitle>
            <CardDescription>Order ID: {order.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <p className="text-lg font-semibold capitalize">
                  {order.status}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total
                </p>
                <p className="text-lg font-semibold">
                  ₹{order.total.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Order Items</h3>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}x {item.productTitle}
                      {item.variantTitle && ` - ${item.variantTitle}`}
                    </span>
                    <span>
                      ₹
                      {("lineTotal" in item
                        ? item.lineTotal
                        : item.price * item.quantity
                      ).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{order.subtotal.toFixed(2)}</span>
              </div>
              {order.gstAmount > 0 && (
                <div className="flex justify-between">
                  <span>GST</span>
                  <span>₹{order.gstAmount.toFixed(2)}</span>
                </div>
              )}
              {order.shippingCost > 0 && (
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>₹{order.shippingCost.toFixed(2)}</span>
                </div>
              )}
              {order.paymentFee && order.paymentFee > 0 && (
                <div className="flex justify-between">
                  <span>Payment Fee</span>
                  <span>₹{(order.paymentFee / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>₹{order.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <Link href="/account/orders" className="flex-1">
                <Button variant="outline" className="w-full">
                  View All Orders
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button className="w-full">Continue Shopping</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Simple confirmation for non-logged-in users
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-label="Order confirmed checkmark"
          >
            <title>Order confirmed checkmark</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-2">Order Placed Successfully!</h1>
        <p className="text-muted-foreground">
          Your order has been confirmed. We've sent you a confirmation email
          with your order details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Confirmation</CardTitle>
          <CardDescription>Order ID: {orderId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Your order has been placed successfully. You can track your order
              using the order ID above.
            </p>
            <p className="text-sm text-muted-foreground">
              A confirmation email has been sent to your email address with
              complete order details.
            </p>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">What's Next?</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>You'll receive an email confirmation shortly</li>
              <li>We'll notify you when your order ships</li>
              <li>Track your order using the order ID</li>
            </ul>
          </div>

          <div className="pt-4 flex gap-4">
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full">
                Continue Shopping
              </Button>
            </Link>
            <Link href="/auth/register" className="flex-1">
              <Button className="w-full">Create Account to Track Orders</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const orderId = resolvedParams.id;

  if (!orderId) {
    redirect("/checkout/error?message=Invalid order ID");
  }

  try {
    return <OrderConfirmationContent orderId={orderId} />;
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirect(
      `/checkout/error?message=${encodeURIComponent("Failed to load order details")}`,
    );
  }
}
