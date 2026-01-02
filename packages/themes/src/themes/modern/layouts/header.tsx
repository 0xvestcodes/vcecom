"use client";

import type React from "react";

interface HeaderLayoutProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Modern theme header layout wrapper
 * The actual header content (logo, nav, cart, auth) will be passed as children
 * from the storefront which has access to hooks and CMS data
 */
export function ModernHeaderLayout({
  children,
  className = "",
}: HeaderLayoutProps) {
  return (
    <header
      className={`sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">{children}</div>
      </div>
    </header>
  );
}
