"use client";

import type React from "react";

interface FooterLayoutProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Modern theme footer layout wrapper
 * Footer content will be passed as children from the storefront
 */
export function ModernFooterLayout({
  children,
  className = "",
}: FooterLayoutProps) {
  return (
    <footer className={`border-t bg-muted/50 ${className}`}>
      <div className="container mx-auto px-4 py-8">{children}</div>
    </footer>
  );
}
