"use client";

import { MapPin, Store } from "lucide-react";
import { SettingsSheet } from "@/components/layout/settings-sheet";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

/**
 * Refactored Store Settings using SettingsSheet pattern
 *
 * Settings should feel like toggling system switches, not editing entities
 * One screen = One group of settings
 */
export function StoreSettingsRefactored() {
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

  const handleSave = async () => {
    // TODO: Implement save logic
    console.log("Saving store settings...");
  };

  return (
    <SettingsSheet
      title="Store Settings"
      description="Manage store metadata and configuration"
      onSave={handleSave}
      isSaving={false}
    >
      {/* Store Information Section */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              <CardTitle className="text-sm">Store Information</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Basic store information and settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Store Name</Label>
                <p className="text-sm font-medium">{store.name}</p>
              </div>
              <div className="space-y-2">
                <Label>Domain</Label>
                <p className="text-sm font-medium">{store.domain}</p>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Badge variant="secondary" className="text-xs">
                  {store.currency}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <p className="text-sm font-medium">{store.timezone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <CardTitle className="text-sm">Store Address</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Physical store location
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">{store.address.street}</p>
              <p className="text-sm">
                {store.address.city}, {store.address.state}{" "}
                {store.address.pincode}
              </p>
              <p className="text-sm">{store.address.country}</p>
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
    </SettingsSheet>
  );
}
