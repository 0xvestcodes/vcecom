import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server/api";
import { getCustomerSession } from "@/lib/server/auth";
import { getOrCreateSessionId } from "@/lib/server/session";
import { CartItemActions } from "./cart-item-actions";
import { CartPrice } from "./cart-price";

export default async function CartPage() {
  const session = await getCustomerSession();
  const sessionId = session ? null : await getOrCreateSessionId();

  const headers: HeadersInit = {};
  if (sessionId) {
    headers["X-Session-Id"] = sessionId;
  }

  const cart = await serverApiFetch<{
    items: Array<{
      id: string;
      productId: string;
      variantId: string;
      productTitle: string;
      variantTitle: string | null;
      thumbnail: string | null;
      quantity: number;
      pricing: {
        unitPrice: number;
        lineTotal: number;
      };
    }>;
    subtotal: number;
    total: number;
  }>("/store/cart", {
    headers,
  }).catch(() => ({ items: [], subtotal: 0, total: 0 }));

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
      {cart.items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Your cart is empty</p>
          <Button asChild>
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="relative w-24 h-24 bg-muted rounded-md overflow-hidden">
                      {item.thumbnail ? (
                        <Image
                          src={item.thumbnail}
                          alt={item.productTitle}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Link href={`/products/${item.productId}`}>
                        <h3 className="font-semibold hover:text-primary transition-colors">
                          {item.productTitle}
                        </h3>
                      </Link>
                      {item.variantTitle && (
                        <p className="text-sm text-muted-foreground">
                          {item.variantTitle}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-1">
                        <CartPrice value={item.pricing.unitPrice} /> each
                      </p>
                      <CartItemActions
                        itemId={item.id}
                        quantity={item.quantity}
                      />
                      <div className="mt-2 text-sm font-semibold">
                        Line Total: <CartPrice value={item.pricing.lineTotal} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <CartPrice value={cart.subtotal} />
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <CartPrice value={cart.total} />
                </div>
                <Button className="w-full" asChild>
                  <Link href="/checkout">Proceed to Checkout</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
