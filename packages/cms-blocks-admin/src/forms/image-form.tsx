"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { imageBlock } from "@vcecom/cms-blocks";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { BlockFormProps } from "../types";

type ImageFormData = {
  src?: string;
  alt?: string;
  caption?: string;
};

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

export function ImageForm({
  form,
  onSubmit,
  onCancel,
}: BlockFormProps<ImageFormData>) {
  const [isUploading, setIsUploading] = useState(false);
  const srcValue = form.watch("src");
  const [previewUrl, setPreviewUrl] = useState<string | null>(srcValue || null);

  // Sync preview URL when form value changes externally
  useEffect(() => {
    if (srcValue !== previewUrl) {
      setPreviewUrl(srcValue || null);
    }
  }, [srcValue, previewUrl]);

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit?.(data);
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadImage(file, "cms/blocks/image");
      setPreviewUrl(url);
      form.setValue("src", url);
    } catch (error) {
      console.error("Failed to upload image:", error);
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Image</label>
        {previewUrl ? (
          <div className="space-y-2">
            <div className="relative w-full h-48 rounded-lg border overflow-hidden bg-gray-100">
              {/* biome-ignore lint/performance/noImgElement: Admin panel */}
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-2">
              <input
                {...form.register("src")}
                type="text"
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="Image URL"
                readOnly
                value={previewUrl}
              />
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(null);
                  form.setValue("src", "");
                }}
                className="px-3 py-2 border rounded-md hover:bg-gray-100"
                disabled={isUploading}
              >
                Remove
              </button>
            </div>
            <label className="block">
              <span className="block text-sm text-gray-600 mb-1">
                Replace Image
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
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
                      } as React.ChangeEvent<HTMLInputElement>);
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
            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
              <svg
                className="w-8 h-8 text-gray-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </label>
          </div>
        )}
        {form.formState.errors.src && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.src.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Alt Text</label>
        <input
          {...form.register("alt")}
          type="text"
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Image description"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Caption</label>
        <input
          {...form.register("caption")}
          type="text"
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Optional caption"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Create image form with react-hook-form
 */
export function createImageForm(defaultValues?: ImageFormData) {
  return useForm<ImageFormData>({
    resolver: zodResolver(imageBlock.propsSchema),
    defaultValues: defaultValues || imageBlock.defaultProps,
  });
}
