"use client";

import { SettingsSheet } from "@/components/layout/settings-sheet";
import { PermissionsMatrix } from "./permissions-matrix";
import { RolesList } from "./roles-list";

/**
 * Refactored Roles Settings using SettingsSheet pattern
 *
 * Settings should feel like toggling system switches, not editing entities
 * One screen = One group of settings
 */
export function RolesSettingsRefactored() {
  const handleSave = async () => {
    // TODO: Implement save logic
    console.log("Saving roles settings...");
  };

  return (
    <SettingsSheet
      title="Roles & Permissions"
      description="Manage user roles and permissions for admin access"
      onSave={handleSave}
      isSaving={false}
    >
      <div className="space-y-6">
        <RolesList />
        <PermissionsMatrix />
      </div>
    </SettingsSheet>
  );
}
