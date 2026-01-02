"use client";

import { Upload, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStorageUpload } from "@/hooks/storage/use-storage-upload";

interface ImageUploadFieldProps {
  label?: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  prefix?: string;
  required?: boolean;
  className?: string;
}

/**
 * Reusable Image Upload Field Component
 * Uses storage service for file uploads instead of URL input
 */
export function ImageUploadField({
  label = "Image",
  value,
  onChange,
  prefix = "cms",
  required = false,
  className,
}: ImageUploadFieldProps) {
  const { uploadFile, isUploading } = useStorageUpload({ prefix });
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    try {
      const result = await uploadFile(file);
      const imageUrl = result.url || result.key;
      setPreviewUrl(imageUrl);
      onChange(imageUrl);
    } catch (error) {
      console.error("Failed to upload image:", error);
      // Error is already handled by the hook (toast notification)
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onChange(null);
  };

  // Update preview when value changes externally
  if (value !== previewUrl && value !== undefined) {
    setPreviewUrl(value || null);
  }

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <Label htmlFor="image-upload">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {previewUrl ? (
        <div className="space-y-2">
          <div className="relative w-full h-48 rounded-lg border overflow-hidden bg-muted">
            {/* biome-ignore lint/performance/noImgElement: Admin panel, dynamic URLs */}
            <img
              src={previewUrl}
              alt={label}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            <Input
              value={previewUrl}
              readOnly
              className="flex-1"
              placeholder="Image URL"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleRemove}
              disabled={isUploading}
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </div>
          <div className="flex gap-2">
            <label htmlFor="image-upload-replace" className="flex-1">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isUploading}
                asChild
              >
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Replace Image"}
                </span>
              </Button>
              <input
                id="image-upload-replace"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors bg-muted/50">
          <label
            htmlFor="image-upload"
            className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              {isUploading ? "Uploading..." : "Click to upload image"}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              PNG, JPG, WEBP up to 50MB
            </span>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </label>
        </div>
      )}
    </div>
  );
}
