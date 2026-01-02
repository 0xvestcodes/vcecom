import { z } from "zod";
import { minimalTheme } from "./themes/minimal";
import { modernTheme } from "./themes/modern";
import type { Theme } from "./types";
import { themeSchema } from "./types";

/**
 * Theme registry - maps theme IDs to theme definitions
 */
const themes: Record<string, Theme> = {};

/**
 * Register a theme
 */
export function registerTheme(theme: Theme): void {
  // Validate theme against schema
  const validated = themeSchema.parse(theme);
  themes[validated.id] = validated;
}

/**
 * Get a theme by ID
 */
export function getTheme(themeId: string): Theme | null {
  return themes[themeId] || null;
}

/**
 * Get all available themes
 */
export function getAllThemes(): Theme[] {
  return Object.values(themes);
}

/**
 * Get theme IDs
 */
export function getThemeIds(): string[] {
  return Object.keys(themes);
}

/**
 * Check if a theme exists
 */
export function hasTheme(themeId: string): boolean {
  return themeId in themes;
}

// Register built-in themes
registerTheme(modernTheme);
registerTheme(minimalTheme);

export default {
  registerTheme,
  getTheme,
  getAllThemes,
  getThemeIds,
  hasTheme,
};
