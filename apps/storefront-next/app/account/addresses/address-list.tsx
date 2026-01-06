"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteAddress } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Address {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface AddressListProps {
  addresses: Address[];
}

export function AddressList({ addresses }: AddressListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(addressId: string) {
    if (!confirm("Are you sure you want to delete this address?")) {
      return;
    }

    setDeletingId(addressId);
    const formData = new FormData();
    formData.append("addressId", addressId);

    const result = await deleteAddress(addressId);
    setDeletingId(null);

    if (result.success) {
      toast.success("Address deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete address");
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {addresses.map((address) => (
        <Card key={address.id}>
          <CardHeader>
            <CardTitle className="text-lg">{address.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{address.phone}</p>
            <p className="text-sm">
              {address.addressLine1}
              {address.addressLine2 && `, ${address.addressLine2}`}
            </p>
            <p className="text-sm">
              {address.city}, {address.state} {address.postalCode}
            </p>
            <p className="text-sm">{address.country}</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" asChild>
                <a href={`/account/addresses/${address.id}/edit`}>Edit</a>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(address.id)}
                disabled={deletingId === address.id}
              >
                {deletingId === address.id ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
