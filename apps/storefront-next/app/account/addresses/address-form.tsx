"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddressFormProps {
  action: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  initialData?: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving..." : "Save Address"}
    </Button>
  );
}

export function AddressForm({ action, initialData }: AddressFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (
      _prevState: { error?: string; success?: boolean } | undefined,
      formData: FormData,
    ) => {
      return action(formData);
    },
    undefined,
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Address saved successfully");
      router.push("/account/addresses");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={initialData?.name}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            defaultValue={initialData?.phone}
            placeholder="+91 1234567890"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address Line 1</Label>
        <Input
          id="addressLine1"
          name="addressLine1"
          required
          defaultValue={initialData?.addressLine1}
          placeholder="Street address"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
        <Input
          id="addressLine2"
          name="addressLine2"
          defaultValue={initialData?.addressLine2}
          placeholder="Apartment, suite, etc."
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            required
            defaultValue={initialData?.city}
            placeholder="City"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            name="state"
            required
            defaultValue={initialData?.state}
            placeholder="State"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            name="postalCode"
            required
            defaultValue={initialData?.postalCode}
            placeholder="PIN"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          name="country"
          required
          defaultValue={initialData?.country || "India"}
          placeholder="Country"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <SubmitButton />
    </form>
  );
}
