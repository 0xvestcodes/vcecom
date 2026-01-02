"use client";

import { useState } from "react";

interface ImageUploadFieldProps {
  label?: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  prefix?: string;
  required?: boolean;
  className?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function uploadImage(file: File, prefix = "cms/blocks"): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("prefix", prefix);

  const response = await fetch(`${API_URL}/admin/storage/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to upload image");
  }

  const data = await response.json();
  return data.url || data.key;
}

/**
 * Standalone Image Upload Field Component for CMS Blocks
 * Uses storage service for file uploads
 */
export function ImageUploadField({
  label = "Image",
  value,
  onChange,
  prefix = "cms/blocks",
  required = false,
  className,
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadImage(file, prefix);
      setPreviewUrl(url);
      onChange(url);
    } catch (error) {
      console.error("Failed to upload image:", error);
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
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

  const inputId = `image-upload-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {previewUrl ? (
        <div className="space-y-2">
          <div className="relative w-full h-48 rounded-lg border overflow-hidden bg-gray-100">
            {/* biome-ignore lint/performance/noImgElement: Admin panel */}
            <img
              src={previewUrl}
              alt={label}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={previewUrl}
              readOnly
              className="flex-1 px-3 py-2 border rounded-md"
              placeholder="Image URL"
            />
            <button
              type="button"
              onClick={handleRemove}
              disabled={isUploading}
              className="px-3 py-2 border rounded-md hover:bg-gray-100 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
          <label className="block">
            <button
              type="button"
              className="w-full px-3 py-2 border rounded-md hover:bg-gray-100 disabled:opacity-50"
              disabled={isUploading}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    handleFileSelect({
                      target: { files: [file] },
                    } as unknown as React.ChangeEvent<HTMLInputElement>);
                  }
                };
                input.click();
              }}
            >
              {isUploading ? "Uploading..." : "Replace Image"}
            </button>
          </label>
        </div>
      ) : (
        <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg hover:border-blue-500 transition-colors bg-gray-50">
          <label
            htmlFor={inputId}
            className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
          >
            <svg
              className="w-8 h-8 text-gray-400 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="Upload icon"
            >
              <title>Upload icon</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm text-gray-600">
              {isUploading ? "Uploading..." : "Click to upload image"}
            </span>
            <span className="text-xs text-gray-400 mt-1">
              PNG, JPG, WEBP up to 50MB
            </span>
            <input
              id={inputId}
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
