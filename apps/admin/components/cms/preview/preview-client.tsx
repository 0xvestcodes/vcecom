"use client";

import { ExternalLink, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Preview Mode Client
 * Controls for preview mode with draft content
 */
export function PreviewClient() {
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  const handleEnterPreview = () => {
    // TODO: Generate preview token and open storefront
    const token = "preview-token-placeholder";
    setPreviewToken(token);
    setIsPreviewActive(true);

    // Open storefront in new tab with preview token
    const storefrontUrl = `${process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3002"}?preview=${token}`;
    window.open(storefrontUrl, "_blank");
  };

  const handleExitPreview = () => {
    setIsPreviewActive(false);
    setPreviewToken(null);
  };

  return (
    <AdminPageLayout
      title="Preview Mode"
      description="Preview draft content on the storefront"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Preview Mode" },
      ]}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Preview Mode</CardTitle>
            <CardDescription>
              View your draft content on the storefront before publishing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPreviewActive ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <Eye className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">
                      Preview mode is active
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Draft content is visible on the storefront
                    </p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExitPreview}>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Exit Preview Mode
                  </Button>
                  <Button variant="outline" asChild>
                    <a
                      href={`${process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3002"}?preview=${previewToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Storefront
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click the button below to enter preview mode. This will open
                  the storefront with draft content visible.
                </p>
                <Button onClick={handleEnterPreview}>
                  <Eye className="mr-2 h-4 w-4" />
                  Enter Preview Mode
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Switch</CardTitle>
            <CardDescription>
              Switch between draft and published content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">
                View Draft
              </Button>
              <Button variant="outline" className="flex-1">
                View Published
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminPageLayout>
  );
}
