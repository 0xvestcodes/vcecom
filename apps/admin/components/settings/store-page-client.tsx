"use client";

import { MapPin, Store } from "lucide-react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Store metadata management page
 *
 * Note: Currently displays single store information.
 * Multi-store management requires backend APIs.
 */
export function StorePageClient() {
  // TODO: Replace with actual store data from API
  const store = {
    id: "default",
    name: "Default Store",
    domain: "store.example.com",
    currency: "INR",
    timezone: "Asia/Kolkata",
    address: {
      street: "123 Main Street",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
    },
  };

  return (
    <AdminPageLayout
      title="Store Settings"
      description="Manage store metadata and configuration"
    >
      <div className="space-y-4">
        <Card className="rounded-xl border-border/50 bg-card/50">
          <CardHeader className="p-4">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              <CardTitle className="text-sm">Store Information</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Basic store information and settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Store Name
                </div>
                <p className="text-xs font-medium">{store.name}</p>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Domain
                </div>
                <p className="text-xs font-medium">{store.domain}</p>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Currency
                </div>
                <Badge variant="secondary" className="text-xs">
                  {store.currency}
                </Badge>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Timezone
                </div>
                <p className="text-xs font-medium">{store.timezone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-card/50">
          <CardHeader className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <CardTitle className="text-sm">Store Address</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Physical store location
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              <p className="text-xs">{store.address.street}</p>
              <p className="text-xs">
                {store.address.city}, {store.address.state}{" "}
                {store.address.pincode}
              </p>
              <p className="text-xs">{store.address.country}</p>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-border/50 bg-card/30 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Store management APIs are not yet available
            in the backend. Multi-store support will be available in a future
            update.
          </p>
        </div>
      </div>
    </AdminPageLayout>
  );
}
