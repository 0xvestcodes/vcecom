"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

// Dynamically import Lexical to avoid SSR issues
const LexicalEditor = dynamic(
  () =>
    import("../lexical-editor-internal").then(
      (mod) => mod.LexicalEditorInternal,
    ),
  { ssr: false },
);

import type { Entry } from "@/lib/types/cms";

interface BlogContentPaneProps {
  entry: Entry;
}

/**
 * Blog Content Pane
 * Main content editor for blog posts
 */
export function BlogContentPane({ entry }: BlogContentPaneProps) {
  const [title, setTitle] = useState((entry.data.title as string) || "");
  const [heroImage, _setHeroImage] = useState(
    (entry.data.heroImage as string) || "",
  );
  const [content, setContent] = useState((entry.data.content as string) || "");

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="blog-title">Title</Label>
        <Input
          id="blog-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter post title"
        />
      </div>

      {/* Hero Image */}
      <div className="space-y-2">
        <Label>Hero Image</Label>
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          {heroImage ? (
            // biome-ignore lint/performance/noImgElement: Admin panel, external URLs may not be optimized
            <img
              src={heroImage}
              alt="Hero"
              className="max-w-full h-auto rounded-lg"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Click to upload hero image
            </p>
          )}
        </div>
      </div>

      {/* Rich Text Content */}
      <div className="space-y-2">
        <Label>Content</Label>
        <BlogRichTextEditor value={content} onChange={setContent} />
      </div>
    </div>
  );
}

/**
 * Standalone Rich Text Editor for Blog
 */
function BlogRichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [editorValue, setEditorValue] = useState<unknown>(value);

  // Fetch route registry for autocomplete
  const { data: routeSlugs } = useQuery<{
    products: Array<{ slug: string; entityId: string }>;
    collections: Array<{ slug: string; entityId: string }>;
    cmsPages: Array<{ slug: string; entityId: string }>;
  }>({
    queryKey: ["route-registry", "slugs"],
    queryFn: async () => {
      try {
        const products =
          (await api.get<Array<{ slug: string; entityId: string }>>(
            endpoints.cms.routeRegistry?.slugs("product") ||
              "/admin/cms/route-registry/slugs?entityType=product",
          )) || [];
        const collections =
          (await api.get<Array<{ slug: string; entityId: string }>>(
            endpoints.cms.routeRegistry?.slugs("collection") ||
              "/admin/cms/route-registry/slugs?entityType=collection",
          )) || [];
        const cmsPages =
          (await api.get<Array<{ slug: string; entityId: string }>>(
            endpoints.cms.routeRegistry?.slugs("cms_page") ||
              "/admin/cms/route-registry/slugs?entityType=cms_page",
          )) || [];
        return {
          products: Array.isArray(products) ? products : [],
          collections: Array.isArray(collections) ? collections : [],
          cmsPages: Array.isArray(cmsPages) ? cmsPages : [],
        };
      } catch (error) {
        console.error("Failed to fetch route registry:", error);
        return { products: [], collections: [], cmsPages: [] };
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleChange = (content: unknown) => {
    setEditorValue(content);
    onChange(typeof content === "string" ? content : JSON.stringify(content));
  };

  useEffect(() => {
    if (value !== editorValue) {
      setEditorValue(value);
    }
  }, [value, editorValue]);

  return (
    <div className="border rounded-lg overflow-hidden min-h-[400px] bg-background">
      <LexicalEditor
        content={editorValue}
        onChange={handleChange}
        placeholder="Start writing your blog post..."
        routeSlugs={routeSlugs}
      />
    </div>
  );
}
