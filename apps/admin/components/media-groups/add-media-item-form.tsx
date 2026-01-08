"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Image as ImageIcon, Upload } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { endpoints } from "@/lib/endpoints";
import type { FileMetadata } from "@/lib/types/storage";
import { isImageFile } from "@/lib/utils/file-utils";

const addMediaItemSchema = z.object({
  altText: z.string().max(500, "Alt text is too long").optional(),
  caption: z.string().max(1000, "Caption is too long").optional(),
  displayOrder: z.number().int().min(0).optional().default(0),
  linkUrl: z
    .string()
    .url("Invalid URL")
    .max(500, "URL is too long")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

type AddMediaItemFormData = z.infer<typeof addMediaItemSchema>;

interface AddMediaItemFormProps {
  storageFiles: FileMetadata[];
  selectedFile: { key: string; url: string } | null;
  onFileSelect: (file: { key: string; url: string } | null) => void;
  onSubmit: (
    data: Omit<AddMediaItemFormData, "groupId" | "storageKey" | "url">,
  ) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function AddMediaItemForm({
  storageFiles,
  selectedFile,
  onFileSelect,
  onSubmit,
  onCancel,
  isLoading = false,
}: AddMediaItemFormProps) {
  const [uploading, setUploading] = useState(false);
  const imageFiles = storageFiles.filter((file) => isImageFile(file.key));

  const form = useForm<AddMediaItemFormData>({
    resolver: zodResolver(addMediaItemSchema) as any,
    defaultValues: {
      altText: "",
      caption: "",
      displayOrder: 0,
      linkUrl: "",
      isActive: true,
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("prefix", "media");

    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${API_URL}${endpoints.storage.upload}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onFileSelect({ key: data.key, url: data.url });
        toast.success("Image uploaded successfully");
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.message || "Failed to upload image");
      }
    } catch (_error) {
      toast.error("Error uploading image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit: SubmitHandler<AddMediaItemFormData> = async (data) => {
    if (!selectedFile) {
      toast.error("Please select or upload an image first");
      return;
    }
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* File Selection */}
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">
              Select or Upload Image
            </div>
            <div className="space-y-4">
              {/* Upload New */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label htmlFor="upload" className="cursor-pointer">
                        <Button type="button" variant="outline" asChild>
                          <span>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload New Image
                          </span>
                        </Button>
                        <input
                          id="upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={uploading}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground mt-2">
                        Upload a new image to storage
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Select from Storage */}
              {imageFiles.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Or select from existing images:
                  </p>
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
                    {imageFiles.map((file) => (
                      <button
                        key={file.key}
                        type="button"
                        onClick={() =>
                          onFileSelect({ key: file.key, url: file.url })
                        }
                        className={`relative aspect-square rounded overflow-hidden border-2 transition-all ${
                          selectedFile?.key === file.key
                            ? "border-primary ring-2 ring-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Image
                          src={file.url}
                          alt={file.key}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected File Preview */}
              {selectedFile && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="relative h-20 w-20 rounded overflow-hidden border">
                        <Image
                          src={selectedFile.url}
                          alt="Selected"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Selected Image</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {selectedFile.key}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {imageFiles.length === 0 && !selectedFile && (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No images in storage</p>
                  <p className="text-xs">Upload an image to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Form Fields */}
        {selectedFile && (
          <>
            <FormField
              control={form.control}
              name="altText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alt Text</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Descriptive alt text for accessibility"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional alt text for screen readers
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="caption"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Caption</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Image caption" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional caption to display with the image
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="linkUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link URL (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="/collections/summer-sale" {...field} />
                  </FormControl>
                  <FormDescription>
                    URL to navigate to when image is clicked
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Order</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </FormControl>
                  <FormDescription>Lower numbers appear first</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Inactive images won't appear on the storefront
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={isLoading || uploading || !selectedFile}
          >
            {isLoading ? "Adding..." : "Add Image"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
