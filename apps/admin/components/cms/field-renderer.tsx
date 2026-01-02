"use client";

import { Upload } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useStorageUpload } from "@/hooks/storage/use-storage-upload";
import type { FieldDefinition } from "@/lib/types/cms";
import { MarkdownField } from "./markdown-field";
import { RelationFieldSelector } from "./relation-field-selector";
import { RichTextEditor } from "./rich-text-editor";

interface FieldRendererProps {
  field: FieldDefinition;
  value?: unknown;
}

/**
 * Renders a form field based on field definition
 * Supports all CMS field types with proper validation and UX
 */
export function FieldRenderer({ field, value }: FieldRendererProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext();

  const fieldValue = watch(field.name) ?? value ?? field.default ?? "";
  const fieldError = errors[field.name];

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.name}>
            {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={field.name}
            {...register(field.name, {
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
              pattern: field.pattern
                ? {
                    value: new RegExp(field.pattern),
                    message: "Invalid format",
                  }
                : undefined,
            })}
            placeholder={field.default as string}
            maxLength={field.maxLength}
            aria-invalid={fieldError ? "true" : "false"}
          />
          <FieldError error={fieldError?.message as string} />
        </div>
      );

    case "rich_text": {
      // Check if field has editorType property to determine which editor to use
      const editorType = (field as { editorType?: string }).editorType;
      if (editorType === "lexical") {
        return (
          <RichTextEditor
            field={field}
            value={fieldValue}
            fieldError={fieldError}
          />
        );
      }
      // Default to markdown editor
      return (
        <MarkdownField
          field={field}
          value={fieldValue as string}
          fieldError={fieldError}
        />
      );
    }

    case "rich_text_lexical":
      return (
        <RichTextEditor
          field={field}
          value={fieldValue}
          fieldError={fieldError}
        />
      );

    case "number":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.name}>
            {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={field.name}
            type="number"
            {...register(field.name, {
              required: field.required ? `${field.name} is required` : false,
              valueAsNumber: true,
            })}
            placeholder={field.default as string}
            aria-invalid={fieldError ? "true" : "false"}
          />
          <FieldError error={fieldError?.message as string} />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor={field.name}>
              {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            {field.default !== undefined && (
              <p className="text-xs text-muted-foreground">
                Default: {field.default ? "Yes" : "No"}
              </p>
            )}
          </div>
          <Switch
            id={field.name}
            checked={fieldValue as boolean}
            onCheckedChange={(checked) => setValue(field.name, checked)}
            aria-invalid={fieldError ? "true" : "false"}
          />
          <FieldError error={fieldError?.message as string} />
        </div>
      );

    case "select":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.name}>
            {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Select
            value={(fieldValue as string) || ""}
            onValueChange={(value) => setValue(field.name, value)}
          >
            <SelectTrigger
              id={field.name}
              aria-invalid={fieldError ? "true" : "false"}
            >
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError error={fieldError?.message as string} />
        </div>
      );

    case "image":
      return (
        <ImageFieldRenderer
          field={field}
          value={fieldValue as string}
          fieldError={fieldError}
        />
      );

    case "relation":
      return (
        <RelationFieldRenderer
          field={field}
          value={fieldValue as string}
          fieldError={fieldError}
        />
      );

    default:
      return (
        <div className="space-y-2">
          <Label>{field.name}</Label>
          <Input
            {...register(field.name)}
            placeholder="Unsupported field type"
            disabled
          />
        </div>
      );
  }
}

/**
 * Relation field renderer with searchable selector
 */
function RelationFieldRenderer({
  field,
  value,
  fieldError,
}: {
  field: FieldDefinition;
  value?: string;
  fieldError?: { message?: string };
}) {
  const { setValue } = useFormContext();

  if (!field.relationContentTypeId) {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.name}>
          {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id={field.name}
          value={value || ""}
          onChange={(e) => setValue(field.name, e.target.value)}
          placeholder="Entry ID"
          aria-invalid={fieldError ? "true" : "false"}
        />
        <FieldError error={fieldError?.message as string} />
        <p className="text-xs text-muted-foreground">
          Enter the ID of the related entry
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <RelationFieldSelector
        contentTypeId={field.relationContentTypeId}
        value={value}
        onSelect={(entryId) => setValue(field.name, entryId)}
        placeholder="Select related entry..."
      />
      <FieldError error={fieldError?.message as string} />
    </div>
  );
}

/**
 * Image field renderer with upload functionality
 */
function ImageFieldRenderer({
  field,
  value,
  fieldError,
}: {
  field: FieldDefinition;
  value?:
    | string
    | { url?: string; key?: string; filename?: string; size?: number };
  fieldError?: { message?: string };
}) {
  const { setValue } = useFormContext();
  const { uploadFile, isUploading } = useStorageUpload();

  const imageUrl =
    typeof value === "string" ? value : value?.url || value?.key || "";
  const imageValue =
    typeof value === "object" && value !== null ? value : undefined;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadFile(file);
      // Storage upload returns { key, url } - use url
      setValue(field.name, result.url || result.key);
    } catch (_error) {
      // Error handled by hook
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {imageUrl ? (
        <div className="space-y-2">
          <div className="relative w-full h-48 rounded-lg border overflow-hidden">
            {/* biome-ignore lint/performance/noImgElement: Admin panel, external URLs may not be optimized */}
            <img
              src={imageUrl}
              alt={field.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            <Input
              id={field.name}
              value={imageUrl}
              readOnly
              className="flex-1"
              placeholder="Image URL"
            />
            {imageValue?.filename && (
              <p className="text-xs text-muted-foreground self-center">
                {imageValue.filename}
                {imageValue.size &&
                  ` (${(imageValue.size / 1024).toFixed(1)} KB)`}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setValue(field.name, null)}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors">
          <label
            htmlFor={`${field.name}-upload`}
            className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              {isUploading ? "Uploading..." : "Click to upload"}
            </span>
            <input
              id={`${field.name}-upload`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </label>
        </div>
      )}
      <FieldError error={fieldError?.message as string} />
    </div>
  );
}
