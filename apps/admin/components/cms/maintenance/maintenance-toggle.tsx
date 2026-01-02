"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAdminContentTypes } from "@/hooks/cms/use-admin-content-types";
import { useAdminPublishEntry } from "@/hooks/cms/use-admin-publish-entry";
import { useAdminUpdateEntry } from "@/hooks/cms/use-admin-update-entry";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { Entry } from "@/lib/types/cms";

export function MaintenanceToggle() {
  const queryClient = useQueryClient();
  const { data: contentTypes } = useAdminContentTypes();
  const maintenanceContentType = contentTypes?.find(
    (ct) => ct.name === "maintenance_mode",
  );

  // Fetch maintenance mode entry
  const { data: maintenanceEntries, isLoading } = useQuery({
    queryKey: [
      endpoints.cms.entries.list(maintenanceContentType?.id || ""),
      { limit: 1 },
    ],
    queryFn: async () => {
      if (!maintenanceContentType) return null;
      const url = endpoints.cms.entries.list(maintenanceContentType.id);
      const response = (await api.get(`${url}?limit=1`)) as {
        data?: { data?: Entry[] };
      };
      return response.data?.data || [];
    },
    enabled: !!maintenanceContentType,
  });

  const maintenanceEntry = maintenanceEntries?.[0];
  const updateEntry = useAdminUpdateEntry(
    maintenanceEntry?.id || "",
    maintenanceContentType?.id || "",
  );
  const publishEntry = useAdminPublishEntry(
    maintenanceEntry?.id || "",
    maintenanceContentType?.id || "",
  );

  const [enabled, setEnabled] = useState(
    maintenanceEntry?.data?.enabled === true,
  );
  const [title, setTitle] = useState(
    (maintenanceEntry?.data?.title as string) || "We'll be back soon!",
  );
  const [message, setMessage] = useState(
    (maintenanceEntry?.data?.message as string) ||
      "We're currently performing some maintenance. Please check back shortly.",
  );
  const [expectedEndTime, setExpectedEndTime] = useState(
    (maintenanceEntry?.data?.expectedEndTime as string) || "",
  );

  // Update local state when entry changes
  useEffect(() => {
    if (maintenanceEntry) {
      setEnabled(maintenanceEntry.data?.enabled === true);
      setTitle(
        (maintenanceEntry.data?.title as string) || "We'll be back soon!",
      );
      setMessage(
        (maintenanceEntry.data?.message as string) ||
          "We're currently performing some maintenance. Please check back shortly.",
      );
      setExpectedEndTime(
        (maintenanceEntry.data?.expectedEndTime as string) || "",
      );
    }
  }, [maintenanceEntry]);

  const handleSave = async () => {
    if (!maintenanceEntry || !maintenanceContentType) return;

    try {
      await updateEntry.mutateAsync({
        data: {
          enabled,
          title,
          message,
          expectedEndTime: expectedEndTime || undefined,
        },
      });

      // Publish immediately to make changes live
      await publishEntry.mutateAsync();

      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: [endpoints.cms.entries.list(maintenanceContentType.id)],
      });

      toast.success(
        enabled ? "Maintenance mode enabled" : "Maintenance mode disabled",
      );
    } catch (error) {
      toast.error("Failed to update maintenance mode");
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!maintenanceContentType || !maintenanceEntry) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Maintenance mode content type not found. Please run the seed script to
          create it.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance Mode</CardTitle>
        <CardDescription>
          Enable or disable maintenance mode for the storefront. When enabled,
          all visitors will be redirected to a maintenance page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="maintenance-enabled">Enable Maintenance Mode</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, the storefront will show a maintenance page to all
              visitors
            </p>
          </div>
          <Switch
            id="maintenance-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {enabled && (
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="maintenance-title">Title</Label>
              <Input
                id="maintenance-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="We'll be back soon!"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance-message">Message</Label>
              <Textarea
                id="maintenance-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="We're currently performing some maintenance. Please check back shortly."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance-end-time">
                Expected End Time (Optional)
              </Label>
              <Input
                id="maintenance-end-time"
                type="datetime-local"
                value={expectedEndTime}
                onChange={(e) => setExpectedEndTime(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This will be displayed on the maintenance page
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={updateEntry.isPending || publishEntry.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {updateEntry.isPending || publishEntry.isPending
              ? "Saving..."
              : "Save & Publish"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
