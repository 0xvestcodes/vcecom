"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { SEOFields, type SEOFieldsData } from "@/components/cms/seo-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Entry } from "@/lib/types/cms";

interface PageMetaPaneProps {
  entry: Entry;
}

/**
 * Right pane: Meta/SEO panel
 * Shows URL, SEO fields, publish settings, and link validation
 */
export function PageMetaPane({ entry }: PageMetaPaneProps) {
  const [slug, setSlug] = useState(entry.slug || "");
  const [seoData, setSeoData] = useState<SEOFieldsData>(() => {
    // Initialize SEO data from entry
    const data = entry.data as Record<string, unknown>;
    return {
      title: (data.seoTitle as string) || "",
      description: (data.seoDescription as string) || "",
      ogTitle: (data.seoTitle as string) || "",
      ogDescription: (data.seoDescription as string) || "",
      ogImages: data.seoOgImage
        ? [{ url: data.seoOgImage as string, alt: "" }]
        : undefined,
    };
  });
  const [status, setStatus] = useState(
    entry.currentWorkflowStatus || entry.status || "draft",
  );

  const linkWarnings: string[] = []; // TODO: Fetch from link validation service

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-4">Page Settings</h3>

        {/* URL/Slug */}
        <div className="space-y-2 mb-4">
          <Label htmlFor="slug">URL (Slug)</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/</span>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="page-slug"
            />
          </div>
        </div>

        {/* SEO Fields */}
        <div className="mb-4">
          <SEOFields
            value={seoData}
            onChange={setSeoData}
            prefix="cms/pages/seo"
          />
        </div>

        {/* Publish Settings */}
        <div className="space-y-2 mb-4">
          <Label htmlFor="status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as "draft" | "published" | "review")
            }
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="review">In Review</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Link Validation Warnings */}
        {linkWarnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-1">
                {linkWarnings.length} link issue(s) found
              </p>
              <ul className="text-xs list-disc list-inside space-y-1">
                {linkWarnings.map((warning, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Warning list, order is stable and items don't change
                  <li key={`warning-${index}`}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-4 border-t">
          <button
            type="button"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Save Changes
          </button>
          <button
            type="button"
            className="w-full border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
