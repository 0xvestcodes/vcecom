"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAdminDeleteProductImage } from "@/hooks/products/use-admin-delete-product-image";
import { useAdminUploadProductImage } from "@/hooks/products/use-admin-upload-product-image";
import { endpoints } from "@/lib/endpoints";
import type { ProductImage } from "@/lib/types/products";
import { MediaInspector } from "./media/media-inspector";
import { MediaReorder } from "./media/media-reorder";
import { MediaUploader } from "./media/media-uploader";

interface ImageManagerProps {
  productId: string;
  images: ProductImage[];
  variantId?: string;
  onImagesChange?: () => void;
  disabled?: boolean;
}

const MAX_PRODUCT_IMAGES = 15;
const MAX_VARIANT_IMAGES = 10;

export function ImageManager({
  productId,
  images,
  variantId,
  onImagesChange,
  disabled = false,
}: ImageManagerProps) {
  const [_isDragging, setIsDragging] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [useCustomVariantImages, setUseCustomVariantImages] = useState(false);
  const uploadImage = useAdminUploadProductImage(productId);
  const deleteImage = useAdminDeleteProductImage(productId);

  const productImages = images.filter((img) => !img.variantId);
  const variantSpecificImages = images.filter(
    (img) => img.variantId === variantId,
  );
  const displayImages =
    variantId && useCustomVariantImages ? variantSpecificImages : productImages;

  const maxImages = variantId ? MAX_VARIANT_IMAGES : MAX_PRODUCT_IMAGES;
  const currentImageCount = displayImages.length;

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !productId || disabled) return;

      const fileArray = Array.from(files);
      const remainingSlots = maxImages - currentImageCount;

      if (fileArray.length > remainingSlots) {
        toast.error(
          `Maximum ${maxImages} images allowed. You can upload ${remainingSlots} more image${remainingSlots !== 1 ? "s" : ""}.`,
        );
        return;
      }

      for (const file of fileArray) {
        try {
          // Upload to storage
          const formData = new FormData();
          formData.append("file", file);
          formData.append("prefix", variantId ? "variants" : "products");

          // Upload directly to backend - cookies sent automatically
          // Use enhanced upload for better performance and multiple sizes
          formData.append(
            "bucketType",
            variantId ? "uploads" : "product-media",
          );
          const API_URL =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
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

          // Add image to product
          await uploadImage.mutateAsync({
            imageKey,
            variantId:
              variantId && useCustomVariantImages ? variantId : undefined,
          });

          onImagesChange?.();
        } catch (_error) {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    },
    [
      productId,
      variantId,
      uploadImage,
      onImagesChange,
      disabled,
      maxImages,
      currentImageCount,
      useCustomVariantImages,
    ],
  );

  const _handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  const _handleDelete = useCallback(
    async (imageId: string) => {
      if (confirm("Are you sure you want to delete this image?")) {
        await deleteImage.mutateAsync({ imageId });
        onImagesChange?.();
      }
    },
    [deleteImage, onImagesChange],
  );

  const _handleImageClick = useCallback((image: ProductImage) => {
    setSelectedImage(image);
    setInspectorOpen(true);
  }, []);

  const sortedImages = [...displayImages].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {/* Variant Image Toggle */}
      {variantId && (
        <div className="flex items-center space-x-2 p-4 border rounded-lg">
          <Switch
            id="use-custom-variant-images"
            checked={useCustomVariantImages}
            onCheckedChange={setUseCustomVariantImages}
            disabled={disabled}
          />
          <Label htmlFor="use-custom-variant-images" className="cursor-pointer">
            Use custom variant images (instead of product images)
          </Label>
        </div>
      )}

      {/* Upload Zone */}
      <MediaUploader
        onUploadComplete={(imageKey) => {
          uploadImage.mutateAsync({
            imageKey,
            variantId:
              variantId && useCustomVariantImages ? variantId : undefined,
          });
          onImagesChange?.();
        }}
        prefix={variantId && useCustomVariantImages ? "variants" : "products"}
        disabled={disabled || currentImageCount >= maxImages}
        maxFiles={maxImages - currentImageCount}
      />

      {/* Image Count Warning */}
      {currentImageCount >= maxImages && (
        <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
          Maximum {maxImages} image{maxImages > 1 ? "s" : ""} reached. Please
          delete an image before uploading a new one.
        </div>
      )}

      {/* Image Grid with Reorder */}
      {sortedImages.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            {variantId && useCustomVariantImages
              ? "Variant Images"
              : "Product Images"}{" "}
            ({currentImageCount}/{maxImages})
          </h3>
          <MediaReorder
            images={sortedImages}
            productId={productId}
            onReorder={onImagesChange}
          />
        </div>
      )}

      {/* Media Inspector */}
      <MediaInspector
        image={selectedImage}
        productId={productId}
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        onImageChange={onImagesChange}
      />
    </div>
  );
}
