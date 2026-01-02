"use client";

import type { BlockType } from "@vcecom/cms-blocks";
import {
  getBlockCategories,
  getBlockMetadata,
  getBlocksByCategory,
} from "@vcecom/cms-blocks-admin";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BlocksPanelProps {
  onAddBlock: (blockType: BlockType) => void;
}

/**
 * Left panel: Available blocks
 * Shows searchable list of blocks grouped by category
 */
export function BlocksPanel({ onAddBlock }: BlocksPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const categories = getBlockCategories();

  // Filter blocks by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories.map((category) => ({
        category,
        blocks: getBlocksByCategory(category),
      }));
    }

    const query = searchQuery.toLowerCase();
    return categories
      .map((category) => {
        const blocks = getBlocksByCategory(category).filter(
          (meta) =>
            meta.displayName.toLowerCase().includes(query) ||
            meta.description.toLowerCase().includes(query) ||
            meta.type.toLowerCase().includes(query),
        );
        return { category, blocks };
      })
      .filter(({ blocks }) => blocks.length > 0);
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-2">Available Blocks</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {filteredCategories.map(({ category, blocks }) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-2">
                {category}
              </h4>
              <div className="space-y-1">
                {blocks.map((meta) => (
                  <Button
                    key={meta.type}
                    variant="ghost"
                    className="w-full justify-start text-left h-auto py-2 px-2"
                    onClick={() => onAddBlock(meta.type)}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm font-medium">
                        {meta.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {meta.description}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No blocks found matching "{searchQuery}"
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
