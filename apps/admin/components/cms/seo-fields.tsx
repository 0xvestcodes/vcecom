"use client";

import { useState } from "react";
import { ImageUploadField } from "@/components/cms/image-upload-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/**
 * Next.js Metadata type structure:
 * {
 *   title?: string | { default: string; template?: string }
 *   description?: string
 *   keywords?: string[]
 *   authors?: Array<{ name: string; url?: string }>
 *   creator?: string
 *   publisher?: string
 *   robots?: string | { index?: boolean; follow?: boolean; ... }
 *   openGraph?: {
 *     title?: string
 *     description?: string
 *     url?: string
 *     siteName?: string
 *     images?: Array<{ url: string; width?: number; height?: number; alt?: string }>
 *     locale?: string
 *     type?: string
 *   }
 *   twitter?: {
 *     card?: "summary" | "summary_large_image" | "app" | "player"
 *     title?: string
 *     description?: string
 *     images?: Array<string | { url: string; width?: number; height?: number; alt?: string }>
 *     creator?: string
 *     site?: string
 *   }
 *   alternates?: { canonical?: string; languages?: Record<string, string> }
 *   category?: string
 *   classification?: string
 *   other?: Record<string, string | string[]>
 * }
 */

export interface SEOFieldsData {
  // Basic fields
  title?: string;
  description?: string;
  keywords?: string[]; // Comma-separated input, stored as array
  authors?: string; // Comma-separated, stored as array
  creator?: string;
  publisher?: string;
  robots?: string;
  category?: string;
  classification?: string;

  // Open Graph
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogSiteName?: string;
  ogLocale?: string;
  ogType?: string;
  ogImages?: Array<{
    url: string;
    width?: number;
    height?: number;
    alt?: string;
  }>;

  // Twitter
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  twitterTitle?: string;
  twitterDescription?: string;
  twitterCreator?: string;
  twitterSite?: string;
  twitterImages?: Array<
    string | { url: string; width?: number; height?: number; alt?: string }
  >;

  // Alternates
  canonicalUrl?: string;
}

interface SEOFieldsProps {
  value?: SEOFieldsData;
  onChange: (value: SEOFieldsData) => void;
  prefix?: string; // For image upload prefix
}

/**
 * Comprehensive SEO Fields Component
 * Includes all fields that Next.js Metadata object expects
 * All images use upload components instead of URL inputs
 */
export function SEOFields({
  value = {},
  onChange,
  prefix = "cms/seo",
}: SEOFieldsProps) {
  const [localValue, setLocalValue] = useState<SEOFieldsData>(value);

  const updateField = <K extends keyof SEOFieldsData>(
    field: K,
    val: SEOFieldsData[K],
  ) => {
    const updated = { ...localValue, [field]: val };
    setLocalValue(updated);
    onChange(updated);
  };

  const updateArrayField = (field: keyof SEOFieldsData, val: string) => {
    const array = val
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    updateField(field, array as SEOFieldsData[typeof field]);
  };

  const getArrayFieldValue = (field: keyof SEOFieldsData): string => {
    const val = localValue[field];
    if (Array.isArray(val)) {
      return val.join(", ");
    }
    return "";
  };

  // Handle OG image upload
  const handleOgImageUpload = (url: string | null) => {
    if (!url) {
      updateField("ogImages", undefined);
      return;
    }
    updateField("ogImages", [{ url, alt: "" }]);
  };

  // Handle Twitter image upload
  const handleTwitterImageUpload = (url: string | null) => {
    if (!url) {
      updateField("twitterImages", undefined);
      return;
    }
    updateField("twitterImages", [url]);
  };

  const ogImageUrl =
    Array.isArray(localValue.ogImages) && localValue.ogImages.length > 0
      ? localValue.ogImages[0].url
      : null;

  const twitterImageUrl =
    Array.isArray(localValue.twitterImages) &&
    localValue.twitterImages.length > 0
      ? typeof localValue.twitterImages[0] === "string"
        ? localValue.twitterImages[0]
        : localValue.twitterImages[0].url
      : null;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="openGraph">Open Graph</TabsTrigger>
          <TabsTrigger value="twitter">Twitter</TabsTrigger>
        </TabsList>

        {/* Basic SEO Fields */}
        <TabsContent value="basic" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="seo-title">Title</Label>
            <Input
              id="seo-title"
              value={localValue.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Page title"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              {localValue.title?.length || 0}/60 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo-description">Description</Label>
            <Textarea
              id="seo-description"
              value={localValue.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Meta description"
              maxLength={160}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {localValue.description?.length || 0}/160 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo-keywords">Keywords (comma-separated)</Label>
            <Input
              id="seo-keywords"
              value={getArrayFieldValue("keywords")}
              onChange={(e) => updateArrayField("keywords", e.target.value)}
              placeholder="keyword1, keyword2, keyword3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="seo-creator">Creator</Label>
              <Input
                id="seo-creator"
                value={localValue.creator || ""}
                onChange={(e) => updateField("creator", e.target.value)}
                placeholder="Author name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-publisher">Publisher</Label>
              <Input
                id="seo-publisher"
                value={localValue.publisher || ""}
                onChange={(e) => updateField("publisher", e.target.value)}
                placeholder="Publisher name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo-authors">Authors (comma-separated)</Label>
            <Input
              id="seo-authors"
              value={getArrayFieldValue("authors")}
              onChange={(e) => updateArrayField("authors", e.target.value)}
              placeholder="Author 1, Author 2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="seo-robots">Robots</Label>
              <Input
                id="seo-robots"
                value={localValue.robots || ""}
                onChange={(e) => updateField("robots", e.target.value)}
                placeholder="index, follow"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-category">Category</Label>
              <Input
                id="seo-category"
                value={localValue.category || ""}
                onChange={(e) => updateField("category", e.target.value)}
                placeholder="Category"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo-canonical">Canonical URL</Label>
            <Input
              id="seo-canonical"
              value={localValue.canonicalUrl || ""}
              onChange={(e) => updateField("canonicalUrl", e.target.value)}
              placeholder="https://example.com/page"
            />
          </div>
        </TabsContent>

        {/* Open Graph Fields */}
        <TabsContent value="openGraph" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="og-title">OG Title</Label>
            <Input
              id="og-title"
              value={localValue.ogTitle || ""}
              onChange={(e) => updateField("ogTitle", e.target.value)}
              placeholder="Open Graph title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="og-description">OG Description</Label>
            <Textarea
              id="og-description"
              value={localValue.ogDescription || ""}
              onChange={(e) => updateField("ogDescription", e.target.value)}
              placeholder="Open Graph description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="og-url">OG URL</Label>
              <Input
                id="og-url"
                value={localValue.ogUrl || ""}
                onChange={(e) => updateField("ogUrl", e.target.value)}
                placeholder="https://example.com/page"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="og-site-name">OG Site Name</Label>
              <Input
                id="og-site-name"
                value={localValue.ogSiteName || ""}
                onChange={(e) => updateField("ogSiteName", e.target.value)}
                placeholder="Site name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="og-locale">OG Locale</Label>
              <Input
                id="og-locale"
                value={localValue.ogLocale || ""}
                onChange={(e) => updateField("ogLocale", e.target.value)}
                placeholder="en_US"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="og-type">OG Type</Label>
              <Input
                id="og-type"
                value={localValue.ogType || ""}
                onChange={(e) => updateField("ogType", e.target.value)}
                placeholder="website"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>OG Image</Label>
            <ImageUploadField
              label="Open Graph Image"
              value={ogImageUrl}
              onChange={handleOgImageUpload}
              prefix={`${prefix}/og`}
            />
            {ogImageUrl &&
              Array.isArray(localValue.ogImages) &&
              localValue.ogImages[0] && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="space-y-1">
                    <Label htmlFor="og-image-width" className="text-xs">
                      Width
                    </Label>
                    <Input
                      id="og-image-width"
                      type="number"
                      value={localValue.ogImages[0].width || ""}
                      onChange={(e) => {
                        const images = [...(localValue.ogImages || [])];
                        if (images[0]) {
                          images[0] = {
                            ...images[0],
                            width: parseInt(e.target.value) || undefined,
                          };
                          updateField("ogImages", images);
                        }
                      }}
                      placeholder="1200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="og-image-height" className="text-xs">
                      Height
                    </Label>
                    <Input
                      id="og-image-height"
                      type="number"
                      value={localValue.ogImages[0].height || ""}
                      onChange={(e) => {
                        const images = [...(localValue.ogImages || [])];
                        if (images[0]) {
                          images[0] = {
                            ...images[0],
                            height: parseInt(e.target.value) || undefined,
                          };
                          updateField("ogImages", images);
                        }
                      }}
                      placeholder="630"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="og-image-alt" className="text-xs">
                      Alt Text
                    </Label>
                    <Input
                      id="og-image-alt"
                      value={localValue.ogImages[0].alt || ""}
                      onChange={(e) => {
                        const images = [...(localValue.ogImages || [])];
                        if (images[0]) {
                          images[0] = { ...images[0], alt: e.target.value };
                          updateField("ogImages", images);
                        }
                      }}
                      placeholder="Image description"
                    />
                  </div>
                </div>
              )}
          </div>
        </TabsContent>

        {/* Twitter Card Fields */}
        <TabsContent value="twitter" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="twitter-card">Twitter Card Type</Label>
            <select
              id="twitter-card"
              value={localValue.twitterCard || "summary"}
              onChange={(e) =>
                updateField(
                  "twitterCard",
                  e.target.value as SEOFieldsData["twitterCard"],
                )
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="summary">Summary</option>
              <option value="summary_large_image">Summary Large Image</option>
              <option value="app">App</option>
              <option value="player">Player</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="twitter-title">Twitter Title</Label>
            <Input
              id="twitter-title"
              value={localValue.twitterTitle || ""}
              onChange={(e) => updateField("twitterTitle", e.target.value)}
              placeholder="Twitter card title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="twitter-description">Twitter Description</Label>
            <Textarea
              id="twitter-description"
              value={localValue.twitterDescription || ""}
              onChange={(e) =>
                updateField("twitterDescription", e.target.value)
              }
              placeholder="Twitter card description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="twitter-creator">Twitter Creator</Label>
              <Input
                id="twitter-creator"
                value={localValue.twitterCreator || ""}
                onChange={(e) => updateField("twitterCreator", e.target.value)}
                placeholder="@username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="twitter-site">Twitter Site</Label>
              <Input
                id="twitter-site"
                value={localValue.twitterSite || ""}
                onChange={(e) => updateField("twitterSite", e.target.value)}
                placeholder="@sitehandle"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Twitter Image</Label>
            <ImageUploadField
              label="Twitter Card Image"
              value={twitterImageUrl}
              onChange={handleTwitterImageUpload}
              prefix={`${prefix}/twitter`}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
