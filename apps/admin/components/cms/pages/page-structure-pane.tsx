"use client";

import { Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Block {
  id: string;
  type: string;
  data: Record<string, unknown>;
  visible: boolean;
}

interface PageStructurePaneProps {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onBlocksChange: (blocks: Block[]) => void;
}

/**
 * Left pane: Blocks structure with drag-and-drop
 */
export function PageStructurePane({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onBlocksChange,
}: PageStructurePaneProps) {
  const handleAddBlock = () => {
    // TODO: Open block type selector
    const newBlock: Block = {
      id: `block-${Date.now()}`,
      type: "rich_text",
      data: {},
      visible: true,
    };
    onBlocksChange([...blocks, newBlock]);
  };

  const handleToggleVisibility = (blockId: string) => {
    onBlocksChange(
      blocks.map((block) =>
        block.id === blockId ? { ...block, visible: !block.visible } : block,
      ),
    );
  };

  const handleDuplicate = (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (block) {
      const newBlock: Block = {
        ...block,
        id: `block-${Date.now()}`,
      };
      const index = blocks.findIndex((b) => b.id === blockId);
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      onBlocksChange(newBlocks);
    }
  };

  const handleDelete = (blockId: string) => {
    onBlocksChange(blocks.filter((block) => block.id !== blockId));
    if (selectedBlockId === blockId) {
      onSelectBlock(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Page Structure</h3>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={handleAddBlock}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Block
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {blocks.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No blocks yet. Click "Add Block" to get started.
            </div>
          ) : (
            blocks.map((block, index) => (
              <div
                key={block.id}
                className={`group flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                  selectedBlockId === block.id
                    ? "bg-accent border-primary"
                    : "hover:bg-accent/50"
                }`}
                onClick={() => onSelectBlock(block.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectBlock(block.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {block.type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Block {index + 1}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(block.id);
                    }}
                  >
                    {block.visible ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs">⋯</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(block.id);
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(block.id);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
