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

  return (
    <AdminPageLayout
      title="Header Navigation"
      description="Manage your site's main navigation menu"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Navigation", href: "/cms/navigation" },
        { label: "Header" },
      ]}
      actions={
        <Button variant="outline" asChild>
          <Link href="/cms/navigation">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Navigation Items</h3>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground mb-4">
              No navigation items yet
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add First Item
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-3 border rounded-lg"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                <Input
                  value={item.label}
                  placeholder="Label"
                  className="flex-1"
                />
                <Select value={item.type}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={item.href} placeholder="URL" className="flex-1" />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </div>
      </div>
    </AdminPageLayout>
  );
}
