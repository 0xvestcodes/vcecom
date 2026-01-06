"use client";

import Image from "next/image";

interface ResponsiveImageProps {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
}

/**
 * Responsive image component with WebP/AVIF support
 * Automatically uses the best available format and size
 */
export function ResponsiveImage({
  src,
  alt,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  className,
  priority = false,
  fill = false,
  width,
  height,
}: ResponsiveImageProps) {
  // Extract base URL and check if we have multiple formats/sizes
  // For now, we'll use the provided src and let Next.js Image handle optimization
  // In the future, we can enhance this to use the enhanced upload response format

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        priority={priority}
        sizes={sizes}
        loading={priority ? undefined : "lazy"}
      />
    );
  }

  if (width && height) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
        sizes={sizes}
        loading={priority ? undefined : "lazy"}
      />
    );
  }

  // Fallback if no dimensions provided
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      priority={priority}
      sizes={sizes}
      loading={priority ? undefined : "lazy"}
    />
  );
}
