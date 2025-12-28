"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { endpoints, get } from "@/lib/api/client";
import { orderSchema, orderTimelineSchema } from "@/lib/validations/order";

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { data: user } = useAuth();

  const { data: order, isLoading } = useQuery({
    queryKey: ["orders", orderId],
    queryFn: async () => {
      const data = await get(endpoints.orders.detail(orderId));
      return orderSchema.parse(data);
    },
    enabled: !!orderId && !!user,
  });

  const { data: timeline } = useQuery({
    queryKey: ["orders", orderId, "timeline"],
    queryFn: async () => {
      const data = await get(endpoints.orders.timeline(orderId));
      return orderTimelineSchema.parse(data);
    },
    enabled: !!orderId && !!user,
  });

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Please login to view order details
            </p>
            <Link href="/auth/login">
              <Button>Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Order not found</p>
            <Link href="/account/orders">
              <Button>Back to Orders</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/account/orders">
          <Button variant="ghost">← Back to Orders</Button>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Order {order.orderNumber}</h1>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start pb-4 border-b last:border-0"
                  >
                    <div>
                      <h3 className="font-semibold">{item.productTitle}</h3>
                      {item.variantTitle && (
                        <p className="text-sm text-muted-foreground">
                          {item.variantTitle}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        Quantity: {item.quantity} × ₹
                        {("unitPrice" in item
                          ? item.unitPrice
                          : item.price
                        ).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        ₹
                        {("lineTotal" in item
                          ? item.lineTotal
                          : item.total
                        ).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          {timeline && timeline.events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Order Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {timeline.events.map((event) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      <div className="flex-1">
                        <p className="font-medium">{event.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{order.subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>GST</span>
                <span>₹{order.gstAmount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Shipping</span>
                <span>₹{order.shippingCost.toFixed(2)}</span>
              </div>

              {order.paymentFee && (
                <div className="flex justify-between">
                  <span>Payment Fee</span>
                  <span>₹{(order.paymentFee / 100).toFixed(2)}</span>
                </div>
              )}

              <div className="border-t pt-4 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>₹{order.total.toFixed(2)}</span>
              </div>

              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">
                      Status:
                    </span>
                    <span
                      className={`ml-2 inline-block px-2 py-1 rounded text-sm font-medium ${
                        order.status === "delivered"
                          ? "bg-green-100 text-green-800"
                          : order.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  {order.paymentMethod && (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Payment:
                      </span>
                      <span className="ml-2 font-medium">
                        {order.paymentMethod}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
