"use client";

import { GripVertical, Trash2 } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Block {
  id: string;
  type: string;
  data: Record<string, unknown>;
  order: number;
}

interface BlockEditorProps {
  fieldName?: string;
  value?: Block[];
}

/**
 * Block Editor Component
 * Allows adding, editing, and reordering blocks
 */
export function BlockEditor({
  fieldName = "blocks",
  value: _value = [],
}: BlockEditorProps) {
  const { setValue, watch } = useFormContext();
  const blocks = (watch(fieldName) as Block[]) || [];

  const addBlock = (type: string) => {
    const newBlock: Block = {
      id: crypto.randomUUID(),
      type,
      data: {},
      order: blocks.length,
    };
    setValue(fieldName, [...blocks, newBlock], { shouldValidate: true });
  };

  const removeBlock = (id: string) => {
    setValue(
      fieldName,
      blocks.filter((b) => b.id !== id),
      { shouldValidate: true },
    );
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setValue(
      fieldName,
      blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      { shouldValidate: true },
    );
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    const index = blocks.findIndex((b) => b.id === id);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;

    const newBlocks = [...blocks];
    [newBlocks[index], newBlocks[newIndex]] = [
      newBlocks[newIndex],
      newBlocks[index],
    ];
    // Update order
    newBlocks.forEach((b, i) => {
      b.order = i;
    });
    setValue(fieldName, newBlocks, { shouldValidate: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Content Blocks</Label>
        <Select
          onValueChange={(value) => {
            if (value) addBlock(value);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Add Block" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hero">Hero Section</SelectItem>
            <SelectItem value="rich_text">Rich Text</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="product_reference">Product Reference</SelectItem>
            <SelectItem value="product_list">Product List</SelectItem>
            <SelectItem value="collection_reference">
              Collection Reference
            </SelectItem>
            <SelectItem value="button">Button/CTA</SelectItem>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="faq">FAQ</SelectItem>
            <SelectItem value="testimonials">Testimonials</SelectItem>
            <SelectItem value="pricing_table">Pricing Table</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {blocks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            No blocks added yet. Click "Add Block" to get started.
          </div>
        ) : (
          blocks.map((block, index) => (
            <BlockItem
              key={block.id}
              block={block}
              index={index}
              onUpdate={(updates) => updateBlock(block.id, updates)}
              onRemove={() => removeBlock(block.id)}
              onMove={(direction) => moveBlock(block.id, direction)}
              canMoveUp={index > 0}
              canMoveDown={index < blocks.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface BlockItemProps {
  block: Block;
  index: number;
  onUpdate: (updates: Partial<Block>) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function BlockItem({
  block,
  index: _index,
  onUpdate,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: BlockItemProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">
              {block.type.charAt(0).toUpperCase() + block.type.slice(1)} Block
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMove("up")}
              disabled={!canMoveUp}
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMove("down")}
              disabled={!canMoveDown}
            >
              ↓
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <BlockFieldsEditor block={block} onUpdate={onUpdate} />
      </CardContent>
    </Card>
  );
}

function BlockFieldsEditor({
  block,
  onUpdate: _onUpdate,
}: {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
}) {
  // Simple field editor - can be enhanced with specific field types
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Block type: {block.type}</p>
      <p>Configure block fields here (implementation depends on block type)</p>
    </div>
  );
}
