"use client";

import type React from "react";

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Minimal theme page layout wrapper
 * Page content will be rendered inside this wrapper
 */
export function MinimalPageLayout({
  children,
  className = "",
}: PageLayoutProps) {
  return (
    <div className={`min-h-screen bg-background ${className}`}>{children}</div>
  );
}
