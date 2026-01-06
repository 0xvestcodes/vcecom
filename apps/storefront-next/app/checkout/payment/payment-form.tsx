"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createOrder } from "@/app/actions/orders";
import { WalletPaymentOption } from "@/components/checkout/wallet-payment-option";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface PaymentFormProps {
  sessionId: string;
}

interface PaymentMethod {
  method: string;
  label: string;
  fee: number;
  available: boolean;
  unavailableReason?: string;
}

export function PaymentForm({ sessionId }: PaymentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [orderTotal, setOrderTotal] = useState(0);
  const [walletAmount, setWalletAmount] = useState(0);
  const [pointsAmount, setPointsAmount] = useState(0);

  useEffect(() => {
    async function fetchPaymentMethods() {
      try {
        const response = await fetch(
          `/api/checkout/payment-methods?checkoutSessionId=${sessionId}`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch payment methods");
        }
        const data = await response.json();
        setPaymentMethods(data.methods || []);
        setOrderTotal(data.total || 0);
        // Auto-select first available method
        const firstAvailable = (data.methods || []).find(
          (m: PaymentMethod) => m.available,
        );
        if (firstAvailable) {
          setSelectedMethod(firstAvailable.method);
        }
      } catch (err) {
        console.error("Failed to fetch payment methods:", err);
        toast.error("Failed to load payment methods");
      } finally {
        setLoading(false);
      }
    }
    fetchPaymentMethods();
  }, [sessionId]);

  async function handleSubmit(formData: FormData) {
    if (!selectedMethod) {
      setError("Please select a payment method");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    formData.append("checkoutSessionId", sessionId);
    formData.append("paymentMethodId", selectedMethod);
    if (walletAmount > 0) {
      formData.append("walletAmount", walletAmount.toString());
    }
    if (pointsAmount > 0) {
      formData.append("pointsAmount", pointsAmount.toString());
    }

    try {
      const result = await createOrder(formData);
      if (result.paymentIntentId) {
        toast.success("Order created successfully");
        router.push(`/checkout/success?orderId=${result.paymentIntentId}`);
      } else {
        setError(result.error || "Failed to create order");
        toast.error(result.error || "Payment failed");
      }
    } catch (_err) {
      setError("An unexpected error occurred. Please try again.");
      toast.error("Payment failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Payment Method</CardTitle>
          <CardDescription>
            Choose your preferred payment method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paymentMethods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Payment Method</CardTitle>
          <CardDescription>
            Choose your preferred payment method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No payment methods available. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {orderTotal > 0 && (
        <WalletPaymentOption
          checkoutSessionId={sessionId}
          orderTotal={orderTotal}
          onWalletChange={setWalletAmount}
          onPointsChange={setPointsAmount}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>Select Payment Method</CardTitle>
          <CardDescription>
            Choose your preferred payment method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <label
                  key={method.method}
                  className={`flex items-center justify-between p-4 border rounded-md cursor-pointer transition-colors ${
                    method.available
                      ? selectedMethod === method.method
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.method}
                      checked={selectedMethod === method.method}
                      onChange={() => setSelectedMethod(method.method)}
                      disabled={!method.available}
                      className="mr-2"
                    />
                    <div>
                      <span className="font-medium">{method.label}</span>
                      {method.fee > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          (+{formatCurrency(method.fee)} fee)
                        </span>
                      )}
                      {!method.available && method.unavailableReason && (
                        <p className="text-xs text-destructive mt-1">
                          {method.unavailableReason}
                        </p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !selectedMethod}
            >
              {isSubmitting
                ? "Processing..."
                : selectedMethod === "COD"
                  ? "Place Order"
                  : "Proceed to Payment"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
