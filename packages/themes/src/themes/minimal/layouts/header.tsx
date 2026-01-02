"use client";

import type React from "react";

interface HeaderLayoutProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Minimal theme header layout wrapper
 * Header content will be passed as children from the storefront
 */
export function MinimalHeaderLayout({
  children,
  className = "",
}: HeaderLayoutProps) {
  return (
    <header
      className={`sticky top-0 z-50 w-full border-b bg-background ${className}`}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">{children}</div>
      </div>
    </header>
  );
}
