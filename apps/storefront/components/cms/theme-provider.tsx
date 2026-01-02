"use client";

import type { MergedTheme } from "@vcecom/themes";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface ThemeContextValue {
  theme: MergedTheme | null;
  isLoading: boolean;
  updateThemeSettings: (settings: Partial<MergedTheme>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: MergedTheme | null;
  themeId?: string;
}

/**
 * Theme Provider
 * Fetches theme settings and provides theme context
 * Also listens for theme updates from admin preview iframe
 */
export function ThemeProvider({
  children,
  initialTheme,
  themeId,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<MergedTheme | null>(initialTheme || null);
  const [isLoading, setIsLoading] = useState(!initialTheme);

  const fetchTheme = useCallback(async (id: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(
        `${apiUrl}/store/cms/themes/${id === "active" ? "active" : id}`,
      );
      if (response.ok) {
        const themeData = await response.json();
        setTheme(themeData);
        applyThemeCSS(themeData);
      }
    } catch (error) {
      console.warn("Failed to fetch theme:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch theme settings
  useEffect(() => {
    if (initialTheme) {
      setTheme(initialTheme);
      setIsLoading(false);
      return;
    }

    if (!themeId) {
      // Try to get active theme
      fetchTheme("active").catch(() => {
        setIsLoading(false);
      });
    } else {
      fetchTheme(themeId).catch(() => {
        setIsLoading(false);
      });
    }
  }, [themeId, initialTheme, fetchTheme]);

  // Listen for theme updates from admin preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "THEME_SETTINGS_UPDATE") {
        const { themeId: updatedThemeId, settings } = event.data;
        if (updatedThemeId === themeId || !themeId) {
          setTheme((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              ...settings,
              colors: { ...prev.colors, ...settings.colors },
              typography: { ...prev.typography, ...settings.typography },
              spacing: { ...prev.spacing, ...settings.spacing },
              buttons: { ...prev.buttons, ...settings.buttons },
              layout: { ...prev.layout, ...settings.layout },
            };
          });
          applyThemeCSS({ ...theme, ...settings });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [themeId, theme]);

  const updateThemeSettings = useCallback((settings: Partial<MergedTheme>) => {
    setTheme((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...settings };
      applyThemeCSS(updated);
      return updated;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isLoading, updateThemeSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Apply theme CSS variables to document
 */
function applyThemeCSS(theme: MergedTheme | null) {
  if (!theme) return;

  const root = document.documentElement;

  // Apply colors
  if (theme.colors) {
    Object.entries(theme.colors).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(`--color-${key}`, value);
      }
    });
  }

  // Apply typography
  if (theme.typography) {
    if (theme.typography.fontFamily) {
      root.style.setProperty("--font-family", theme.typography.fontFamily);
    }
    if (theme.typography.fontFamilyHeading) {
      root.style.setProperty(
        "--font-family-heading",
        theme.typography.fontFamilyHeading,
      );
    }
  }

  // Apply spacing
  if (theme.spacing) {
    Object.entries(theme.spacing).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(`--spacing-${key}`, value);
      }
    });
  }

  // Apply layout
  if (theme.layout) {
    Object.entries(theme.layout).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(`--layout-${key}`, value);
      }
    });
  }
}
