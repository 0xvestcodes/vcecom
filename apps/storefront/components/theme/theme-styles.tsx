"use client";

import { useEffect } from "react";

interface ThemeStylesProps {
  css: string;
}

/**
 * Client component to inject theme CSS
 * Required because Next.js App Router doesn't support <head> manipulation in layouts
 */
export function ThemeStyles({ css }: ThemeStylesProps) {
  useEffect(() => {
    if (!css) return;

    // Create or update style element
    let styleElement = document.getElementById("theme-styles");

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = "theme-styles";
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = css;

    // Cleanup on unmount
    return () => {
      const element = document.getElementById("theme-styles");
      if (element) {
        element.remove();
      }
    };
  }, [css]);

  return null;
}
