"use client";

import { Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { endpoints } from "@/lib/endpoints";
import { cn } from "@/lib/utils";

interface MediaUploaderProps {
  onUploadComplete?: (imageKey: string) => void;
  prefix?: string;
  disabled?: boolean;
  maxFiles?: number;
  className?: string;
  useEnhancedUpload?: boolean;
  bucketType?: "product-media" | "uploads" | "internal";
}

interface UploadProgress {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  imageKey?: string;
  error?: string;
}

export function MediaUploader({
  onUploadComplete,
  prefix = "products",
  disabled = false,
  maxFiles = 15,
  className,
  useEnhancedUpload = true,
  bucketType = "product-media",
}: MediaUploaderProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      const _uploadId = `${file.name}-${Date.now()}`;
      const newUpload: UploadProgress = {
        file,
        progress: 0,
        status: "pending",
      };

      setUploads((prev) => [...prev, newUpload]);

      try {
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: "uploading", progress: 10 } : u,
          ),
        );

        const formData = new FormData();
        formData.append("file", file);
        formData.append("prefix", prefix);
        if (useEnhancedUpload) {
          formData.append("bucketType", bucketType);
        }

        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const uploadEndpoint = useEnhancedUpload
          ? endpoints.storage.uploadEnhanced
          : endpoints.storage.upload;
        const uploadResponse = await fetch(`${API_URL}${uploadEndpoint}`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new Error(errorData.message || "Upload failed");
        }

        setUploads((prev) =>
          prev.map((u) => (u.file === file ? { ...u, progress: 90 } : u)),
        );

        const uploadData = await uploadResponse.json();
        // Enhanced upload returns structured response with sizes/formats
        // Use the large size URL for product images, or fallback to original
        const imageKey =
          useEnhancedUpload && uploadData.original
            ? uploadData.original.key || uploadData.original.url
            : uploadData.key || uploadData.url;

        setUploads((prev) =>
          prev.map((u) =>
            u.file === file
              ? { ...u, status: "success", progress: 100, imageKey }
              : u,
          ),
        );

        onUploadComplete?.(imageKey);

        // Remove from list after a delay
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.file !== file));
        }, 2000);
      } catch (error) {
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file
              ? {
                  ...u,
                  status: "error",
                  error:
                    error instanceof Error ? error.message : "Upload failed",
                }
              : u,
          ),
        );
        toast.error(`Failed to upload ${file.name}`);
      }
    },
    [prefix, onUploadComplete, useEnhancedUpload, bucketType],
  );

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || disabled) return;

      const fileArray = Array.from(files).slice(0, maxFiles);
      for (const file of fileArray) {
        await uploadFile(file);
      }
    },
    [uploadFile, disabled, maxFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const activeUploads = uploads.filter(
    (u) => u.status === "pending" || u.status === "uploading",
  );

  return (
    <div className={cn("space-y-4", className)}>
      <section
        aria-label="Image upload drop zone"
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag and drop images here, or click to select
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="media-upload-input"
          disabled={disabled}
        />
        <Button
          variant="outline"
          onClick={() => document.getElementById("media-upload-input")?.click()}
          disabled={disabled || activeUploads.length > 0}
        >
          Select Images
        </Button>
      </section>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div key={`${upload.file.name}-${index}`} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{upload.file.name}</span>
                <span className="text-muted-foreground">
                  {upload.status === "success" && "✓"}
                  {upload.status === "error" && "✗"}
                  {upload.status === "uploading" && `${upload.progress}%`}
                </span>
              </div>
              {(upload.status === "uploading" ||
                upload.status === "pending") && (
                <Progress value={upload.progress} className="h-1" />
              )}
              {upload.status === "error" && upload.error && (
                <p className="text-xs text-destructive">{upload.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
