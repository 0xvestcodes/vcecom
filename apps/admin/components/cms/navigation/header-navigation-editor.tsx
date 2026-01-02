"use client";

import type { NavigationItem } from "./navigation-editor-enhanced";
import { NavigationEditorEnhanced } from "./navigation-editor-enhanced";

/**
 * Header Navigation Editor
 * Enhanced with drag-and-drop and nested menu support
 */
export function HeaderNavigationEditor() {
  const handleSave = (items: NavigationItem[]) => {
    // TODO: Save to CMS entry
    console.log("Saving navigation items:", items);
  };

  return (
    <NavigationEditorEnhanced
      navigationType="header"
      initialItems={[]}
      onSave={handleSave}
    />
  );
}
