"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CollectionPicker } from "@/components/cms/collection-picker";
import { ImageUploadField } from "@/components/cms/image-upload-field";
import { ProductPicker } from "@/components/cms/product-picker";
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

interface BlockDataEditorProps {
  blockType: string;
  blockData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

/**
 * Block Data Editor
 * Renders the appropriate editor for a block type
 */
export function BlockDataEditor({
  blockType,
  blockData,
  onChange,
}: BlockDataEditorProps) {
  const handleFieldChange = (fieldName: string, value: unknown) => {
    onChange({
      ...blockData,
      [fieldName]: value,
    });
  };

  switch (blockType) {
    case "hero":
      return (
        <div className="space-y-4">
          <ImageUploadField
            label="Hero Image"
            value={(blockData.imageUrl as string) || null}
            onChange={(url) => handleFieldChange("imageUrl", url || "")}
            prefix="cms/hero"
          />
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={(blockData.title as string) || ""}
              onChange={(e) => handleFieldChange("title", e.target.value)}
              placeholder="Hero title"
            />
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <Input
              value={(blockData.subtitle as string) || ""}
              onChange={(e) => handleFieldChange("subtitle", e.target.value)}
              placeholder="Hero subtitle"
            />
          </div>
          <div className="space-y-2">
            <Label>CTA Text</Label>
            <Input
              value={(blockData.ctaText as string) || ""}
              onChange={(e) => handleFieldChange("ctaText", e.target.value)}
              placeholder="Button text"
            />
          </div>
          <div className="space-y-2">
            <Label>CTA Link</Label>
            <Input
              value={(blockData.ctaLink as string) || ""}
              onChange={(e) => handleFieldChange("ctaLink", e.target.value)}
              placeholder="/products"
            />
          </div>
        </div>
      );

    case "rich_text":
      return (
        <RichTextBlockEditor
          value={blockData.content}
          onChange={(value) => handleFieldChange("content", value)}
        />
      );

    case "product_reference":
      return (
        <div className="space-y-2">
          <Label>Product</Label>
          <ProductPicker
            value={(blockData.productId as string) || ""}
            onChange={(productId) => handleFieldChange("productId", productId)}
          />
        </div>
      );

    case "collection_reference":
      return (
        <div className="space-y-2">
          <Label>Collection</Label>
          <CollectionPicker
            value={(blockData.collectionId as string) || ""}
            onChange={(collectionId) =>
              handleFieldChange("collectionId", collectionId)
            }
          />
        </div>
      );

    case "media_gallery":
      return (
        <div className="space-y-2">
          <Label>Images</Label>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Media gallery editor coming soon
            </p>
          </div>
        </div>
      );

    case "faq":
      return (
        <div className="space-y-4">
          <Label>FAQ Items</Label>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">
              FAQ repeater editor coming soon
            </p>
          </div>
        </div>
      );

    case "testimonials":
      return (
        <div className="space-y-4">
          <Label>Testimonials</Label>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Testimonials repeater editor coming soon
            </p>
          </div>
        </div>
      );

    default:
      return (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Unknown block type: {blockType}
        </div>
      );
  }
}

/**
 * Standalone Rich Text Block Editor
 * Works without form context
 */
function RichTextBlockEditor({
  value,
  onChange,
}: {
  value?: unknown;
  onChange: (value: unknown) => void;
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
    onChange(content);
  };

  useEffect(() => {
    if (value !== editorValue) {
      setEditorValue(value);
    }
  }, [value, editorValue]);

  return (
    <div className="space-y-2">
      <Label>Content</Label>
      <div className="border rounded-lg overflow-hidden min-h-[300px] bg-background">
        <LexicalEditor
          content={editorValue}
          onChange={handleChange}
          placeholder="Start typing..."
          routeSlugs={routeSlugs}
        />
      </div>
    </div>
  );
}
