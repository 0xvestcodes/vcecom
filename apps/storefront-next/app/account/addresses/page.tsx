import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server/api";
import { getCustomerSession } from "@/lib/server/auth";
import { AddressList } from "./address-list";

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

export default async function AddressesPage() {
  const session = await getCustomerSession();

  if (!session) {
    redirect("/login");
  }

  const addresses = await serverApiFetch<Address[]>(
    "/store/customers/addresses",
  ).catch(() => []);

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Shipping Addresses</h1>
        <Button asChild>
          <Link href="/account/addresses/new">Add New Address</Link>
        </Button>
      </div>
      {addresses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              You have no saved addresses
            </p>
            <Button asChild>
              <Link href="/account/addresses/new">Add Your First Address</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AddressList addresses={addresses} />
      )}
    </div>
  );
}
