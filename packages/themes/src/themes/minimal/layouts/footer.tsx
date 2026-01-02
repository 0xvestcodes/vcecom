"use client";

import type React from "react";

interface FooterLayoutProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Minimal theme footer layout wrapper
 * Footer content will be passed as children from the storefront
 */
export function MinimalFooterLayout({
  children,
  className = "",
}: FooterLayoutProps) {
  return (
    <footer className={`border-t bg-background ${className}`}>
      <div className="container mx-auto px-4 py-12">{children}</div>
    </footer>
  );
}
