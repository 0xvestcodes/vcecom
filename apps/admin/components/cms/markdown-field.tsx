"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { FieldDefinition } from "@/lib/types/cms";

interface MarkdownFieldProps {
  field: FieldDefinition;
  value?: string;
  fieldError?: { message?: string };
}

/**
 * Markdown field renderer with edit/preview tabs
 * Uses react-markdown for rendering (React 19 compatible)
 */
export function MarkdownField({
  field,
  value,
  fieldError,
}: MarkdownFieldProps) {
  const { setValue, watch, register } = useFormContext();
  const fieldValue = watch(field.name) ?? value ?? field.default ?? "";
  const [editorValue, setEditorValue] = useState((fieldValue as string) || "");

  // Register field for validation
  useEffect(() => {
    register(field.name, {
      required: field.required ? `${field.name} is required` : false,
      maxLength: field.maxLength
        ? {
            value: field.maxLength,
            message: `Maximum ${field.maxLength} characters`,
          }
        : undefined,
      minLength: field.minLength
        ? {
            value: field.minLength,
            message: `Minimum ${field.minLength} characters`,
          }
        : undefined,
    });
  }, [field.name, field.required, field.maxLength, field.minLength, register]);

  // Sync form value when editor changes
  useEffect(() => {
    if (editorValue !== fieldValue) {
      setValue(field.name, editorValue, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [editorValue, field.name, setValue, fieldValue]);

  // Update editor when form value changes externally
  useEffect(() => {
    const newValue = (fieldValue as string) || "";
    if (newValue !== editorValue) {
      setEditorValue(newValue);
    }
  }, [fieldValue, editorValue]);

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Tabs defaultValue="edit" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="mt-2">
          <div className="border rounded-lg overflow-hidden min-h-[300px] bg-background">
            <Textarea
              id={field.name}
              value={editorValue}
              onChange={(e) => {
                const newValue = e.target.value;
                setEditorValue(newValue);
              }}
              placeholder={
                (field.default as string) || "Start typing markdown..."
              }
              className="min-h-[300px] resize-none border-0 focus-visible:ring-0 font-mono text-sm"
            />
          </div>
        </TabsContent>
        <TabsContent value="preview" className="mt-2">
          <div className="border rounded-lg overflow-auto min-h-[300px] bg-background p-4">
            {editorValue ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    a: ({ href, children, ...props }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        {...props}
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {editorValue}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No content to preview. Start typing in the Edit tab.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <FieldError error={fieldError?.message as string} />
      <p className="text-xs text-muted-foreground">
        Supports Markdown formatting with live preview. Use the Preview tab to
        see rendered output.
      </p>
    </div>
  );
}
