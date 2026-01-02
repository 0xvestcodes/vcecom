"use client";

import { useState } from "react";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface ImageGalleryBlockProps {
  images: Array<{
    src: string;
    alt?: string;
    caption?: string;
  }>;
  layout?: "grid" | "carousel";
  columns?: "2" | "3" | "4";
  lightbox?: boolean;
}

export function ImageGalleryBlock({
  props,
}: BlockComponentProps<ImageGalleryBlockProps>) {
  const {
    images,
    layout = "grid",
    columns = "3",
    lightbox = true,
    style,
  } = props;
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const gridCols = {
    "2": "md:grid-cols-2",
    "3": "md:grid-cols-3",
    "4": "md:grid-cols-4",
  } as const;

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    layout === "grid"
      ? `grid grid-cols-1 gap-4 ${gridCols[columns]}`
      : "flex gap-4 overflow-x-auto",
    variantClasses[style?.variant || "default"],
  );

  if (layout === "carousel") {
    return (
      <div className={blockClasses}>
        {images.map((image, index) => (
          <div key={index} className="min-w-[300px] flex-shrink-0">
            <img
              src={image.src}
              alt={image.alt || `Gallery image ${index + 1}`}
              className="h-full w-full rounded-lg object-cover"
              onClick={() => lightbox && setSelectedImage(index)}
            />
            {image.caption && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {image.caption}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={blockClasses}>
        {images.map((image, index) => (
          <div key={index}>
            <img
              src={image.src}
              alt={image.alt || `Gallery image ${index + 1}`}
              className="h-full w-full cursor-pointer rounded-lg object-cover transition-transform hover:scale-105"
              onClick={() => lightbox && setSelectedImage(index)}
            />
            {image.caption && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {image.caption}
              </p>
            )}
          </div>
        ))}
      </div>
      {lightbox && selectedImage !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={images[selectedImage]?.src}
            alt={images[selectedImage]?.alt || "Gallery image"}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
        </div>
      )}
    </>
  );
}
