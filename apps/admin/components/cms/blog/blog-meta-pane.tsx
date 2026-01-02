"use client";

import { useState } from "react";
import { SEOFields, type SEOFieldsData } from "@/components/cms/seo-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface BlogMetaPaneProps {
  entry: Entry;
}

/**
 * Blog Meta Pane
 * Right sidebar with SEO, category, tags, publish settings
 */
export function BlogMetaPane({ entry }: BlogMetaPaneProps) {
  const [slug, setSlug] = useState(entry.slug || "");
  const [category, setCategory] = useState(
    (entry.data.category as string) || "",
  );
  const [tags, setTags] = useState((entry.data.tags as string[]) || []);
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-4">Post Settings</h3>

        {/* URL/Slug */}
        <div className="space-y-2 mb-4">
          <Label htmlFor="blog-slug">URL (Slug)</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/blog/</span>
            <Input
              id="blog-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="post-slug"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2 mb-4">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Enter category"
          />
        </div>

        {/* Tags */}
        <div className="space-y-2 mb-4">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tags.join(", ")}
            onChange={(e) =>
              setTags(
                e.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              )
            }
            placeholder="tag1, tag2, tag3"
          />
        </div>

        {/* SEO Fields */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm">SEO</CardTitle>
          </CardHeader>
          <CardContent>
            <SEOFields
              value={seoData}
              onChange={setSeoData}
              prefix="cms/blog/seo"
            />
          </CardContent>
        </Card>

        {/* Publish Settings */}
        <div className="space-y-2 mb-4">
          <Label htmlFor="blog-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as "draft" | "published" | "review")
            }
          >
            <SelectTrigger id="blog-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="review">In Review</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
