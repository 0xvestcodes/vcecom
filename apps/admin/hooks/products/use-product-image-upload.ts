"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { WIZARD_MESSAGES } from "@/lib/constants/wizard.constants";
import { endpoints } from "@/lib/endpoints";

/**
 * Hook for handling product image uploads
 * Manages image upload to storage and association with product
 */
export function useProductImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadImages = useCallback(
    async (productId: string, images: File[]) => {
      if (images.length === 0) return;

      setIsUploading(true);
      setUploadProgress(0);

      const totalImages = images.length;
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < images.length; i++) {
        try {
          await uploadSingleImage(productId, images[i]);
          successCount++;
        } catch (error) {
          failedCount++;
          // Log individual failures but continue with other images
          console.error(`Failed to upload image ${i + 1}:`, error);
        }
        setUploadProgress(((i + 1) / totalImages) * 100);
      }

      // Show appropriate message based on results
      if (failedCount === 0) {
        toast.success(WIZARD_MESSAGES.IMAGE_UPLOAD_SUCCESS);
      } else if (successCount > 0) {
        // Some succeeded, some failed
        toast.warning(
          `${successCount} image(s) uploaded successfully. ${failedCount} image(s) failed to upload. You can add them later.`,
        );
      } else {
        // All failed
        toast.error(WIZARD_MESSAGES.IMAGE_UPLOAD_ERROR);
      }

      setIsUploading(false);
      setUploadProgress(0);
    },
    [],
  );

  return { uploadImages, isUploading, uploadProgress };
}

/**
 * Uploads a single image file
 */
async function uploadSingleImage(productId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("prefix", "products");
  formData.append("bucketType", "product-media");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const uploadResponse = await fetch(
    `${API_URL}${endpoints.storage.uploadEnhanced}`,
    {
      method: "POST",
      body: formData,
      credentials: "include",
    },
  );

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json().catch(() => ({}));
    throw new Error(errorData.message || "Upload failed");
  }

  const uploadData = await uploadResponse.json();

  // Enhanced upload returns structured response with sizes/formats
  // Use the original key for product association
  const imageKey = uploadData.original
    ? uploadData.original.key || uploadData.original.url
    : uploadData.key || uploadData.url;

  await api.post(endpoints.products.images.add(productId), {
    imageKey,
    altText: file.name,
  });
}
