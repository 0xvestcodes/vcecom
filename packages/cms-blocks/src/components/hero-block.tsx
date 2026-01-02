"use client";

import Link from "next/link";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

// Simple button component for blocks
function BlockButton({
  children,
  href,
  size = "lg",
  className,
}: {
  children: React.ReactNode;
  href: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground font-medium transition-colors hover:bg-primary/90",
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

// Simple image component for blocks
function BlockImage({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

interface HeroBlockProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  ctaText?: string;
  ctaLink?: string;
}

export function HeroBlock({ props }: BlockComponentProps<HeroBlockProps>) {
  const { title, subtitle, backgroundImage, ctaText, ctaLink, style } = props;

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(variantClasses[style?.variant || "default"]);

  return (
    <section
      className={cn(
        "relative w-full h-[600px] flex items-center justify-center overflow-hidden",
        blockClasses,
      )}
    >
      {backgroundImage ? (
        <div className="absolute inset-0 z-0">
          <BlockImage
            src={backgroundImage}
            alt={title || "Hero"}
            width={1920}
            height={600}
            className="w-full h-full"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      ) : null}
      <div className="relative z-10 container mx-auto px-4 text-center text-white">
        {title ? <h1 className="text-5xl font-bold mb-4">{title}</h1> : null}
        {subtitle ? (
          <p className="text-xl mb-8 max-w-2xl mx-auto">{subtitle}</p>
        ) : null}
        {ctaText && ctaLink ? (
          <BlockButton href={ctaLink} size="lg">
            {ctaText}
          </BlockButton>
        ) : null}
      </div>
    </section>
  );
}
