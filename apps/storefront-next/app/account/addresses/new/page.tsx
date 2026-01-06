import { redirect } from "next/navigation";
import { addAddress } from "@/app/actions/customer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCustomerSession } from "@/lib/server/auth";
import { AddressForm } from "../address-form";

export default async function NewAddressPage() {
  const session = await getCustomerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Add New Address</h1>
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Address Information</CardTitle>
            <CardDescription>Add a new shipping address</CardDescription>
          </CardHeader>
          <CardContent>
            <AddressForm action={addAddress} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
