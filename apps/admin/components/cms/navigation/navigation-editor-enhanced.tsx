"use client";

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  type: "internal" | "external";
  openInNewTab?: boolean;
  icon?: string;
  children?: NavigationItem[];
}

interface NavigationEditorEnhancedProps {
  navigationType: "header" | "footer";
  initialItems?: NavigationItem[];
  onSave?: (items: NavigationItem[]) => void;
}

/**
 * Enhanced Navigation Editor with drag-and-drop and nested menu support
 */
export function NavigationEditorEnhanced({
  navigationType,
  initialItems = [],
  onSave,
}: NavigationEditorEnhancedProps) {
  const [items, setItems] = useState<NavigationItem[]>(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    // Find items and their parent paths
    const findItemPath = (
      id: string,
      items: NavigationItem[],
      path: number[] = [],
    ): number[] | null => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === id) {
          return [...path, i];
        }
        if (items[i].children) {
          const childPath = findItemPath(id, items[i].children!, [...path, i]);
          if (childPath) return childPath;
        }
      }
      return null;
    };

    const activePath = findItemPath(active.id as string, items);
    const overPath = findItemPath(over.id as string, items);

    if (!activePath || !overPath) return;

    // Same level reordering
    if (activePath.length === overPath.length && activePath.length > 0) {
      const parentPath = activePath.slice(0, -1);
      const activeIndex = activePath[activePath.length - 1];
      const overIndex = overPath[overPath.length - 1];

      if (parentPath.length === 0) {
        // Root level
        const newItems = arrayMove(items, activeIndex, overIndex);
        setItems(newItems);
      } else {
        // Nested level
        const updateNested = (
          currentItems: NavigationItem[],
          path: number[],
        ): NavigationItem[] => {
          if (path.length === 1) {
            const parent = currentItems[path[0]];
            if (parent.children) {
              const newChildren = arrayMove(
                parent.children,
                activeIndex,
                overIndex,
              );
              return currentItems.map((item, idx) =>
                idx === path[0] ? { ...item, children: newChildren } : item,
              );
            }
          } else {
            const [first, ...rest] = path;
            return currentItems.map((item, idx) =>
              idx === first
                ? { ...item, children: updateNested(item.children || [], rest) }
                : item,
            );
          }
          return currentItems;
        };
        setItems(updateNested(items, parentPath));
      }
    }
  };

  const handleAddItem = (parentId?: string) => {
    const newItem: NavigationItem = {
      id: `nav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: "New Item",
      href: "#",
      type: "internal",
    };

    if (parentId) {
      const addToParent = (items: NavigationItem[]): NavigationItem[] => {
        return items.map((item) => {
          if (item.id === parentId) {
            return {
              ...item,
              children: [...(item.children || []), newItem],
            };
          }
          if (item.children) {
            return { ...item, children: addToParent(item.children) };
          }
          return item;
        });
      };
      setItems(addToParent(items));
    } else {
      setItems([...items, newItem]);
    }
  };

  const handleUpdateItem = (id: string, updates: Partial<NavigationItem>) => {
    const updateInTree = (items: NavigationItem[]): NavigationItem[] => {
      return items.map((item) => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        if (item.children) {
          return { ...item, children: updateInTree(item.children) };
        }
        return item;
      });
    };
    setItems(updateInTree(items));
  };

  const handleDeleteItem = (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    const removeFromTree = (items: NavigationItem[]): NavigationItem[] => {
      return items
        .filter((item) => item.id !== id)
        .map((item) => {
          if (item.children) {
            return { ...item, children: removeFromTree(item.children) };
          }
          return item;
        });
    };
    setItems(removeFromTree(items));
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave?.(items);
  };

  return (
    <AdminPageLayout
      title={`${navigationType === "header" ? "Header" : "Footer"} Navigation`}
      description="Manage your site's navigation menu with drag-and-drop"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Navigation", href: "/cms/navigation" },
        { label: navigationType === "header" ? "Header" : "Footer" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/cms/navigation">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      }
    >
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Navigation Items</h3>
            <Button onClick={() => handleAddItem()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">
                No navigation items yet
              </p>
              <Button onClick={() => handleAddItem()}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Item
              </Button>
            </div>
          ) : (
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.map((item) => (
                  <NavigationItemComponent
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateItem}
                    onDelete={handleDeleteItem}
                    onAddChild={handleAddItem}
                    expanded={expandedItems.has(item.id)}
                    onToggleExpanded={toggleExpanded}
                    level={0}
                  />
                ))}
              </div>
            </SortableContext>
          )}

          <DragOverlay>
            {activeId ? (
              <div className="p-3 border rounded-lg bg-background shadow-lg">
                Dragging...
              </div>
            ) : null}
          </DragOverlay>
        </div>
      </DndContext>
    </AdminPageLayout>
  );
}

interface NavigationItemComponentProps {
  item: NavigationItem;
  onUpdate: (id: string, updates: Partial<NavigationItem>) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  expanded: boolean;
  onToggleExpanded: (id: string) => void;
  level: number;
}

function NavigationItemComponent({
  item,
  onUpdate,
  onDelete,
  onAddChild,
  expanded,
  onToggleExpanded,
  level,
}: NavigationItemComponentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasChildren = item.children && item.children.length > 0;

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      <div
        className={`flex items-center gap-2 p-3 border rounded-lg bg-background ${
          isDragging ? "shadow-lg" : ""
        }`}
        style={{ marginLeft: `${level * 24}px` }}
      >
        <div {...attributes} {...listeners} className="cursor-move touch-none">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {hasChildren && (
          <button
            onClick={() => onToggleExpanded(item.id)}
            className="p-1 hover:bg-muted rounded"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}

        <Input
          value={item.label}
          onChange={(e) => onUpdate(item.id, { label: e.target.value })}
          placeholder="Label"
          className="flex-1"
        />

        <Select
          value={item.type}
          onValueChange={(value: "internal" | "external") =>
            onUpdate(item.id, { type: value })
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="external">External</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={item.href}
          onChange={(e) => onUpdate(item.id, { href: e.target.value })}
          placeholder="URL"
          className="flex-1"
        />

        <div className="flex items-center gap-2">
          <Checkbox
            checked={item.openInNewTab || false}
            onCheckedChange={(checked) =>
              onUpdate(item.id, { openInNewTab: checked === true })
            }
          />
          <Label className="text-xs">New Tab</Label>
        </div>

        <Button variant="ghost" size="sm" onClick={() => onAddChild(item.id)}>
          <Plus className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(item.id)}
          className="text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {hasChildren && expanded && (
        <div className="ml-6 space-y-2">
          <SortableContext
            items={item.children!.map((child) => child.id)}
            strategy={verticalListSortingStrategy}
          >
            {item.children!.map((child) => (
              <NavigationItemComponent
                key={child.id}
                item={child}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddChild={onAddChild}
                expanded={expanded}
                onToggleExpanded={onToggleExpanded}
                level={level + 1}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
