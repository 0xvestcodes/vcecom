"use client";

import Link from "next/link";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface AnnouncementBarBlockProps {
  text: string;
  link?: string;
  linkText?: string;
}

export function AnnouncementBarBlock({
  props,
}: BlockComponentProps<AnnouncementBarBlockProps>) {
  const { text, link, linkText } = props;

  return (
    <div className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-sm">
          <span>{text}</span>
          {link && linkText && (
            <Link href={link} className="underline hover:no-underline">
              {linkText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
