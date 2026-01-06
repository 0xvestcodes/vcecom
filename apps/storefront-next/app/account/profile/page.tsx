import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCustomerSession } from "@/lib/server/auth";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await getCustomerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Edit Profile</h1>
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              initialData={{
                email: session.email,
                name: session.name || "",
                phone: session.phone || "",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
