"use client";

import { Save } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface SettingsSheetProps {
  title: string;
  description?: string;
  children: ReactNode;
  onSave?: () => void | Promise<void>;
  isSaving?: boolean;
  saveLabel?: string;
  autoSave?: boolean;
}

/**
 * Universal Settings Sheet Component
 *
 * One-column settings form:
 * - Clean, single-column layout
 * - Autosave or "Save" at bottom
 * - Used for Shipping, Currency, Roles, Store settings, Payment fees
 *
 * @example
 * ```tsx
 * <SettingsSheet
 *   title="Store Settings"
 *   description="Configure your store preferences"
 *   onSave={handleSave}
 * >
 *   <FormField label="Store Name">...</FormField>
 *   <FormField label="Currency">...</FormField>
 * </SettingsSheet>
 * ```
 */
export function SettingsSheet({
  title,
  description,
  children,
  onSave,
  isSaving = false,
  saveLabel = "Save Changes",
  autoSave = false,
}: SettingsSheetProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      <Separator />

      {/* Content */}
      <div className="space-y-6 max-w-2xl">{children}</div>

      {/* Footer */}
      {!autoSave && onSave && (
        <>
          <Separator />
          <div className="flex items-center justify-end">
            <Button onClick={onSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : saveLabel}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
