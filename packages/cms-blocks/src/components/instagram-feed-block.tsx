"use client";

import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface InstagramFeedBlockProps {
  username?: string;
  accessToken?: string;
  postCount?: "6" | "9" | "12";
  columns?: "2" | "3" | "4";
  profileLink?: string;
}

export function InstagramFeedBlock({
  props,
}: BlockComponentProps<InstagramFeedBlockProps>) {
  const {
    username,
    postCount = "6",
    columns = "3",
    profileLink,
    style,
  } = props;

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
    "grid grid-cols-1 gap-4",
    gridCols[columns],
    variantClasses[style?.variant || "default"],
  );

  // Placeholder - in production, this would fetch from Instagram API
  const placeholderPosts = Array.from(
    { length: parseInt(postCount, 10) },
    (_, i) => ({
      id: `post-${i}`,
      image: `https://via.placeholder.com/300x300?text=Instagram+Post+${i + 1}`,
      link: `https://instagram.com/p/post${i}`,
    }),
  );

  return (
    <div className={blockClasses}>
      {placeholderPosts.map((post) => (
        <a
          key={post.id}
          href={post.link}
          target="_blank"
          rel="noopener noreferrer"
          className="aspect-square overflow-hidden rounded-lg"
        >
          {/* biome-ignore lint/performance/noImgElement: External Instagram images, Next.js Image not available in shared package */}
          <img
            src={post.image}
            alt={`Instagram post ${post.id}`}
            className="h-full w-full object-cover transition-transform hover:scale-105"
          />
        </a>
      ))}
      {profileLink && (
        <div className="col-span-full mt-4 text-center">
          <a
            href={profileLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Follow @{username || "us"} on Instagram
          </a>
        </div>
      )}
    </div>
  );
}
