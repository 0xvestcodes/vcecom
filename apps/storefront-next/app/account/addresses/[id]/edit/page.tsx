import { notFound, redirect } from "next/navigation";
import { updateAddress } from "@/app/actions/customer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server/api";
import { getCustomerSession } from "@/lib/server/auth";
import { AddressForm } from "../../address-form";

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

export default async function EditAddressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCustomerSession();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const address = await serverApiFetch<Address>(
    `/store/customers/addresses/${id}`,
  ).catch(() => null);

  if (!address) {
    notFound();
  }

  async function updateAddressAction(formData: FormData) {
    "use server";
    return updateAddress(id, formData);
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Edit Address</h1>
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Address Information</CardTitle>
            <CardDescription>Update your shipping address</CardDescription>
          </CardHeader>
          <CardContent>
            <AddressForm action={updateAddressAction} initialData={address} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
