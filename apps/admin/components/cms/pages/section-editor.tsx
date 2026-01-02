"use client";

import { type BlockType, getBlockDefinition } from "@vcecom/cms-blocks";
import { GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlockEditorWithStyles } from "../blocks/block-editor-with-styles";

export interface Section {
  id: string;
  layout: "container" | "full";
  background?: "accent" | "muted" | "primary" | "secondary";
  padding?: "xs" | "sm" | "md" | "lg" | "xl";
  blocks: Array<{
    id: string;
    type: string;
    order: number;
    props: Record<string, unknown>;
    style?: {
      variant?: "default" | "inset" | "card" | "section" | "ghost";
      padding?: "none" | "sm" | "md" | "lg";
      align?: "left" | "center" | "right";
    };
  }>;
}

interface SectionEditorProps {
  section: Section;
  onUpdate: (section: Section) => void;
  onDelete?: () => void;
}

export function SectionEditor({
  section,
  onUpdate,
  onDelete,
}: SectionEditorProps) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const handleSectionChange = (field: keyof Section, value: unknown) => {
    onUpdate({
      ...section,
      [field]: value,
    });
  };

  const handleAddBlock = (blockType: string) => {
    const newBlock = {
      id: `block-${Date.now()}`,
      type: blockType,
      order: section.blocks.length,
      props: getBlockDefinition(blockType as BlockType)?.defaultProps || {},
    };
    onUpdate({
      ...section,
      blocks: [...section.blocks, newBlock],
    });
  };

  const handleUpdateBlock = (
    blockId: string,
    updatedBlock: Section["blocks"][0],
  ) => {
    onUpdate({
      ...section,
      blocks: section.blocks.map((b) => (b.id === blockId ? updatedBlock : b)),
    });
    setEditingBlockId(null);
  };

  const handleDeleteBlock = (blockId: string) => {
    onUpdate({
      ...section,
      blocks: section.blocks
        .filter((b) => b.id !== blockId)
        .map((b, idx) => ({ ...b, order: idx })),
    });
  };

  const _handleMoveBlock = (blockId: string, direction: "up" | "down") => {
    const index = section.blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= section.blocks.length) return;

    const newBlocks = [...section.blocks];
    [newBlocks[index], newBlocks[newIndex]] = [
      newBlocks[newIndex],
      newBlocks[index],
    ];

    // Update order
    newBlocks.forEach((b, idx) => {
      b.order = idx;
    });

    onUpdate({
      ...section,
      blocks: newBlocks,
    });
  };

  const editingBlock = editingBlockId
    ? section.blocks.find((b) => b.id === editingBlockId)
    : null;

  if (editingBlock) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit Block</CardTitle>
          <CardDescription>
            {getBlockDefinition(editingBlock.type as BlockType)?.displayName ||
              editingBlock.type}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BlockEditorWithStyles
            block={editingBlock}
            onSave={(updated) => handleUpdateBlock(editingBlock.id, updated)}
            onCancel={() => setEditingBlockId(null)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Section Settings</CardTitle>
            <CardDescription>
              Configure section layout and styling
            </CardDescription>
          </div>
          {onDelete && (
            <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Section Layout Controls */}
        <div className="space-y-2">
          <Label htmlFor="section-layout">Layout</Label>
          <Select
            value={section.layout}
            onValueChange={(value) =>
              handleSectionChange("layout", value as Section["layout"])
            }
          >
            <SelectTrigger id="section-layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="container">Container</SelectItem>
              <SelectItem value="full">Full Width</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Container: Max-width with padding. Full: Edge-to-edge width.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="section-background">Background</Label>
          <Select
            value={section.background || "none"}
            onValueChange={(value) =>
              handleSectionChange(
                "background",
                value === "none" ? undefined : (value as Section["background"]),
              )
            }
          >
            <SelectTrigger id="section-background">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="accent">Accent</SelectItem>
              <SelectItem value="muted">Muted</SelectItem>
              <SelectItem value="primary">Primary</SelectItem>
              <SelectItem value="secondary">Secondary</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="section-padding">Padding Override</Label>
          <Select
            value={section.padding || "default"}
            onValueChange={(value) =>
              handleSectionChange(
                "padding",
                value === "default" ? undefined : (value as Section["padding"]),
              )
            }
          >
            <SelectTrigger id="section-padding">
              <SelectValue placeholder="Use theme default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Theme Default</SelectItem>
              <SelectItem value="xs">Extra Small</SelectItem>
              <SelectItem value="sm">Small</SelectItem>
              <SelectItem value="md">Medium</SelectItem>
              <SelectItem value="lg">Large</SelectItem>
              <SelectItem value="xl">Extra Large</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Blocks List */}
        <div className="space-y-2">
          <Label>Blocks ({section.blocks.length})</Label>
          <div className="space-y-2">
            {section.blocks
              .sort((a, b) => a.order - b.order)
              .map((block) => {
                const definition = getBlockDefinition(block.type as BlockType);
                return (
                  <div
                    key={block.id}
                    className="flex items-center gap-2 p-2 border rounded-lg"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {definition?.displayName || block.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order: {block.order + 1}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingBlockId(block.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBlock(block.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Add Block Dropdown */}
          <Select onValueChange={handleAddBlock}>
            <SelectTrigger>
              <SelectValue placeholder="Add Block" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rich_text">Rich Text</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="hero">Hero Banner</SelectItem>
              <SelectItem value="product_grid">Product Grid</SelectItem>
              <SelectItem value="product_carousel">Product Carousel</SelectItem>
              <SelectItem value="collection_showcase">
                Collection Showcase
              </SelectItem>
              <SelectItem value="testimonials">Testimonials</SelectItem>
              <SelectItem value="faq">FAQ</SelectItem>
              <SelectItem value="newsletter">Newsletter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
