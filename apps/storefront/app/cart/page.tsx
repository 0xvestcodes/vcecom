"use client";

import Link from "next/link";
import { useState } from "react";
import { ReservationTimer } from "@/components/cart/reservation-timer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  useApplyCoupon,
  useCart,
  useClearCart,
  useRemoveCartItem,
  useRemoveCoupon,
  useUpdateCartItem,
} from "@/hooks/use-cart";
import { useCartHeartbeat } from "@/hooks/use-cart-heartbeat";

export default function CartPage() {
  const { data: cart, isLoading } = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const [couponCode, setCouponCode] = useState("");

  // Start heartbeat when cart has items
  useCartHeartbeat(!!cart && cart.items.length > 0);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-8" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`skeleton-${i.toString()}`}
                className="h-32 bg-muted rounded"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
          <p className="text-muted-foreground mb-8">
            Add some products to get started
          </p>
          <Link href="/products">
            <Button>Browse Products</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem.mutate(itemId);
    } else {
      updateItem.mutate({ itemId, quantity: newQuantity });
    }
  };

  const handleApplyCoupon = () => {
    if (couponCode.trim()) {
      applyCoupon.mutate(couponCode.trim());
      setCouponCode("");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="md:col-span-2 space-y-4">
          {/* Stale Items Warning */}
          {cart.warnings?.some((w) => w.type === "STALE_ITEMS") && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-200">
                Items Need Revalidation
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                {cart.warnings.find((w) => w.type === "STALE_ITEMS")?.message ||
                  "Some items' reservations expired. We'll check availability when you checkout."}
              </AlertDescription>
            </Alert>
          )}

          {/* Low Stock Warnings */}
          {cart.warnings?.some((w) => w.type === "LOW_STOCK") && (
            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <CardContent className="p-4">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                  Low Stock Warning
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                  {cart.warnings
                    .filter((w) => w.type === "LOW_STOCK")
                    .map((warning, idx) => (
                      <li key={idx}>{warning.message}</li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {cart.items.map((item) => {
            const itemWarning = cart.warnings?.find(
              (w) => w.variantId === item.variantId,
            );
            const isStale = item.isStale || item.state === "stale";
            return (
              <Card
                key={item.id}
                className={
                  itemWarning || isStale ? "border-yellow-500" : ""
                }
              >
                <CardContent className="p-6">
                  {isStale && (
                    <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950 rounded-md border border-orange-200 dark:border-orange-800">
                      <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">
                        ⏱️ Reservation expired. Availability will be checked at checkout.
                      </p>
                    </div>
                  )}
                  {itemWarning && !isStale && (
                    <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                        ⚠️ {itemWarning.message}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-4">
                    {/* Product Image */}
                    {item.thumbnail ? (
                      <Link href={`/products/${item.productSlug}`}>
                        <img
                          src={item.thumbnail}
                          alt={item.productTitle}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      </Link>
                    ) : (
                      <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">
                          No Image
                        </span>
                      </div>
                    )}

                    <div className="flex-1">
                      {/* Product Title */}
                      <Link href={`/products/${item.productSlug}`}>
                        <h3 className="font-semibold mb-1 hover:underline">
                          {item.productTitle}
                        </h3>
                      </Link>

                      {/* Variant Title */}
                      {item.variantTitle && (
                        <p className="text-sm text-muted-foreground mb-1">
                          {item.variantTitle}
                        </p>
                      )}

                      {/* Attributes */}
                      {Object.keys(item.attributes).length > 0 && (
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {Object.entries(item.attributes).map(([key, value]) => (
                            <span
                              key={key}
                              className="text-xs bg-muted px-2 py-1 rounded"
                            >
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* SKU */}
                      <p className="text-xs text-muted-foreground mb-2">
                        SKU: {item.sku}
                      </p>

                      {/* Bundle Info */}
                      {item.type === "bundle" && item.bundleTitle && (
                        <p className="text-sm text-blue-600 mb-2">
                          Bundle: {item.bundleTitle}
                        </p>
                      )}

                      {/* Price Breakdown */}
                      <div className="mb-4">
                        {item.pricing.breakdown.salePrice && (
                          <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded mr-2 mb-1">
                            {item.pricing.breakdown.salePrice.label}
                          </span>
                        )}

                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold">
                            ₹{item.pricing.unitPrice.toFixed(2)}
                          </span>

                          {item.pricing.compareAtPrice && (
                            <span className="text-sm text-muted-foreground line-through">
                              ₹{item.pricing.compareAtPrice.toFixed(2)}
                            </span>
                          )}

                          {item.pricing.breakdown.savings > 0 && (
                            <span className="text-sm text-green-600 font-semibold">
                              Save ₹{item.pricing.breakdown.savings.toFixed(2)} (
                              {item.pricing.breakdown.savingsPercentage.toFixed(0)}%
                              off)
                            </span>
                          )}
                        </div>

                        {item.pricing.breakdown.priceListDiscount && (
                          <p className="text-xs text-blue-600 mt-1">
                            {item.pricing.breakdown.priceListDiscount.listName}{" "}
                            price applied
                          </p>
                        )}
                      </div>

                      {/* Inventory Status */}
                      {item.inventoryStatus === "low_stock" && (
                        <p className="text-sm text-orange-600 mb-2">
                          ⚠️ Only {item.availableQuantity} left in stock!
                        </p>
                      )}

                      {item.inventoryStatus === "out_of_stock" && (
                        <p className="text-sm text-red-600 mb-2">
                          ❌ Out of stock
                        </p>
                      )}

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleQuantityChange(item.id, item.quantity - 1)
                            }
                            disabled={updateItem.isPending}
                          >
                            -
                          </Button>
                          <span className="w-12 text-center">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleQuantityChange(item.id, item.quantity + 1)
                            }
                            disabled={updateItem.isPending}
                          >
                            +
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem.mutate(item.id)}
                          disabled={removeItem.isPending}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-lg">
                        ₹{item.pricing.lineTotal.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} × ₹{item.pricing.unitPrice.toFixed(2)}
                      </p>
                      {cart.expiresAt && (
                        <div className="mt-2">
                          <ReservationTimer
                            expiresAt={cart.expiresAt}
                            onExpire={() => {
                              // Invalidate cart query to refresh data
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Button
            variant="outline"
            onClick={() => clearCart.mutate()}
            disabled={clearCart.isPending}
          >
            Clear Cart
          </Button>
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{cart.priceSummary.subtotal.toFixed(2)}</span>
                </div>

                {cart.priceSummary.itemDiscounts > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Item Discounts</span>
                    <span>-₹{cart.priceSummary.itemDiscounts.toFixed(2)}</span>
                  </div>
                )}

                {cart.discount && cart.priceSummary.couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>
                      Coupon ({cart.discount.code})
                      {cart.discount.percentageSaved > 0 && (
                        <span className="text-xs ml-1">
                          ({cart.discount.percentageSaved.toFixed(0)}% off)
                        </span>
                      )}
                    </span>
                    <span>-₹{cart.priceSummary.couponDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    GST (
                    {cart.priceSummary.gstBreakdown.isIntraState
                      ? "CGST+SGST"
                      : "IGST"}
                    )
                  </span>
                  <span>₹{cart.priceSummary.gstAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>₹{cart.priceSummary.total.toFixed(2)}</span>
                </div>

                {(cart.priceSummary.itemDiscounts +
                  cart.priceSummary.couponDiscount) >
                  0 && (
                  <p className="text-sm text-green-600 text-right mt-2">
                    You saved ₹
                    {(
                      cart.priceSummary.itemDiscounts +
                      cart.priceSummary.couponDiscount
                    ).toFixed(2)}{" "}
                    total!
                  </p>
                )}
                {cart.expiresAt && (
                  <div className="mt-4 pt-4 border-t">
                    <ReservationTimer
                      expiresAt={cart.expiresAt}
                      onExpire={() => {
                        // Invalidate cart query to refresh data
                        // The cart will be refetched and show updated state
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Coupon Code */}
              <div className="space-y-2">
                {cart.discountCode ? (
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">{cart.discountCode}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCoupon.mutate()}
                      disabled={removeCoupon.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleApplyCoupon()
                      }
                    />
                    <Button
                      onClick={handleApplyCoupon}
                      disabled={applyCoupon.isPending || !couponCode.trim()}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>

              <Link href="/checkout" className="block">
                <Button className="w-full" size="lg">
                  Proceed to Checkout
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
