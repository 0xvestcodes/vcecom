"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { addCheckoutAddress, startCheckout } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CheckoutForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      // Get guest email if provided (for guest checkout)
      const email = formData.get("email") as string | undefined;
      const checkoutFormData = new FormData();
      if (email) {
        checkoutFormData.append("guestEmail", email);
      }

      // First start checkout
      const startResult = await startCheckout(checkoutFormData);
      if (!startResult.checkoutSessionId) {
        setError(startResult.error || "Failed to start checkout");
        setIsSubmitting(false);
        return;
      }

      // Get email from form (required for checkout address)
      const formEmail = formData.get("email") as string | undefined;
      if (!formEmail) {
        setError("Email is required for checkout");
        setIsSubmitting(false);
        return;
      }

      // Then add address
      formData.append("checkoutSessionId", startResult.checkoutSessionId);
      const addressResult = await addCheckoutAddress(formData);

      if (addressResult.success) {
        toast.success("Address saved successfully");
        router.push(
          `/checkout/payment?sessionId=${startResult.checkoutSessionId}`,
        );
      } else {
        setError(addressResult.error || "Failed to save address");
      }
    } catch (_err) {
      setError("An unexpected error occurred. Please try again.");
      toast.error("Checkout failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipping Address</CardTitle>
        <CardDescription>
          Enter your shipping address to continue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address Line 1</Label>
            <Input id="addressLine1" name="addressLine1" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input id="addressLine2" name="addressLine2" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input id="postalCode" name="postalCode" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" name="country" defaultValue="India" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "Continue to Payment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
