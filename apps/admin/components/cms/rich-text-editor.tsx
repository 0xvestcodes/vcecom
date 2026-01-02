"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { FieldDefinition } from "@/lib/types/cms";

// Dynamically import Lexical to avoid SSR issues
const LexicalEditor = dynamic(
  () =>
    import("./lexical-editor-internal").then(
      (mod) => mod.LexicalEditorInternal,
    ),
  { ssr: false },
);

interface RichTextEditorProps {
  field: FieldDefinition;
  value?: unknown;
  fieldError?: { message?: string };
}

/**
 * Rich text editor using Lexical with internal linking support
 * Stores content as JSON (Lexical format) or markdown
 */
export function RichTextEditor({
  field,
  value,
  fieldError,
}: RichTextEditorProps) {
  const { setValue, watch, register } = useFormContext();
  const fieldValue = watch(field.name) ?? value ?? field.default ?? null;
  const [editorValue, setEditorValue] = useState<unknown>(fieldValue);

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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Register field for validation
  useEffect(() => {
    register(field.name, {
      required: field.required ? `${field.name} is required` : false,
    });
  }, [field.name, field.required, register]);

  // Sync form value when editor changes
  const handleChange = useCallback(
    (content: unknown) => {
      setEditorValue(content);
      setValue(field.name, content, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [field.name, setValue],
  );

  // Update editor when form value changes externally
  useEffect(() => {
    if (fieldValue !== editorValue) {
      setEditorValue(fieldValue);
    }
  }, [fieldValue, editorValue]);

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="border rounded-lg overflow-hidden min-h-[300px] bg-background">
        <LexicalEditor
          content={editorValue}
          onChange={handleChange}
          placeholder={(field.default as string) || "Start typing..."}
          routeSlugs={routeSlugs}
        />
      </div>
      <FieldError error={fieldError?.message as string} />
      <p className="text-xs text-muted-foreground">
        Rich text editor with internal linking support. Content is stored as
        structured JSON.
      </p>
    </div>
  );
}
