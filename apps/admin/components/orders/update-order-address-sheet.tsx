"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAdminOrder } from "@/hooks/orders/use-admin-order";
import { useUpdateOrderAddress } from "@/hooks/orders/use-update-order-address";
import type { Address } from "@/lib/types/orders";

interface UpdateOrderAddressSheetProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Update Order Address Sheet Component
 *
 * Opens as Sheet from order actions
 * No full page redirects
 */
export function UpdateOrderAddressSheet({
  orderId,
  open,
  onOpenChange,
}: UpdateOrderAddressSheetProps) {
  const { data: order } = useAdminOrder(orderId);
  const updateAddress = useUpdateOrderAddress();
  const [addressType, setAddressType] = useState<"shipping" | "billing">(
    "shipping",
  );
  const [formData, setFormData] = useState<Partial<Address>>({});

  useEffect(() => {
    if (order && open) {
      const address =
        addressType === "shipping"
          ? order.shippingAddress
          : order.billingAddress;
      if (address) {
        setFormData({
          name: address.name,
          phone: address.phone,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2 || "",
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          country: address.country,
          landmark: address.landmark || "",
        });
      }
    }
  }, [order, addressType, open]);

  const handleSubmit = async () => {
    if (!order) return;

    try {
      await updateAddress.mutateAsync({
        orderId,
        addressType,
        address: formData,
      });
      onOpenChange(false);
    } catch (_error) {
      // Error handled by mutation hook
    }
  };

  if (!order) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Update Address</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Address Type</Label>
            <Select
              value={addressType}
              onValueChange={(value) =>
                setAddressType(value as "shipping" | "billing")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shipping">Shipping Address</SelectItem>
                <SelectItem value="billing">Billing Address</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              value={formData.phone || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address Line 1 *</Label>
            <Input
              id="addressLine1"
              value={formData.addressLine1 || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  addressLine1: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input
              id="addressLine2"
              value={formData.addressLine2 || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  addressLine2: e.target.value,
                }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                value={formData.state || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, state: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode *</Label>
              <Input
                id="pincode"
                value={formData.pincode || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    pincode: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                value={formData.country || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="landmark">Landmark</Label>
            <Input
              id="landmark"
              value={formData.landmark || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  landmark: e.target.value,
                }))
              }
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={updateAddress.isPending}>
              {updateAddress.isPending ? "Updating..." : "Update Address"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
