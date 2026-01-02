"use client";

import { cn } from "../utils/cn";
import type { BlockComponentProps } from "./types";

interface VideoBlockProps {
  url?: string;
  title?: string;
}

export function VideoBlock({ props }: BlockComponentProps<VideoBlockProps>) {
  const { url, title, style } = props;

  if (!url) {
    return null;
  }

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    "relative aspect-video",
    variantClasses[style?.variant || "default"],
  );

  // Extract video ID from common video URLs
  const getEmbedUrl = (videoUrl: string): string => {
    // YouTube
    if (
      videoUrl.includes("youtube.com/watch") ||
      videoUrl.includes("youtu.be/")
    ) {
      const youtubeId = videoUrl.includes("youtu.be/")
        ? videoUrl.split("youtu.be/")[1]?.split("?")[0]
        : new URL(videoUrl).searchParams.get("v");
      if (youtubeId) {
        return `https://www.youtube.com/embed/${youtubeId}`;
      }
    }
    // Vimeo
    if (videoUrl.includes("vimeo.com/")) {
      const vimeoId = videoUrl.split("vimeo.com/")[1]?.split("?")[0];
      if (vimeoId) {
        return `https://player.vimeo.com/video/${vimeoId}`;
      }
    }
    // Return as-is if already an embed URL or unknown format
    return videoUrl;
  };

  return (
    <div className={blockClasses}>
      <iframe
        src={getEmbedUrl(url)}
        title={title || "Video"}
        className="w-full h-full rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
