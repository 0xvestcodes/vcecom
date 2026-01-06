"use client";

import type { BlockType } from "@vcecom/cms-blocks";
import { getBlockForm, getBlockMetadata } from "@vcecom/cms-blocks-admin";
import { Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Block } from "@/lib/types/cms";

interface BlockSettingsPanelProps {
  selectedBlock: Block | null;
  onUpdateBlock: (blockId: string, updates: Partial<Block>) => void;
  onDeleteBlock: (blockId: string) => void;
}

/**
 * Right panel: Block settings
 * Shows form for selected block
 */
export function BlockSettingsPanel({
  selectedBlock,
  onUpdateBlock,
  onDeleteBlock,
}: BlockSettingsPanelProps) {
  // Create form with current block props - must be called unconditionally
  const form = useForm<Record<string, unknown>>({
    defaultValues: selectedBlock?.props || {},
  });

  // Reset form when selectedBlock changes - must be called unconditionally
  useEffect(() => {
    if (selectedBlock) {
      form.reset(selectedBlock.props || {});
    }
  }, [selectedBlock?.id, selectedBlock?.props, form, selectedBlock]);

  if (!selectedBlock) {
    return (
      <div className="flex flex-col h-full border-l">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Block Settings</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            Select a block to edit its settings
          </p>
        </div>
      </div>
    );
  }

  const metadata = getBlockMetadata(selectedBlock.type as BlockType);
  const FormComponent = getBlockForm(selectedBlock.type as BlockType);

  const handleSubmit = (data: Record<string, unknown>) => {
    onUpdateBlock(selectedBlock.id, {
      props: data,
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this block?")) {
      onDeleteBlock(selectedBlock.id);
    }
  };

  return (
    <div className="flex flex-col h-full border-l">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Block Settings</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">{metadata.displayName}</span>
          <span className="mx-1">•</span>
          <span>{metadata.category}</span>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {FormComponent ? (
            <FormComponent
              // @ts-expect-error
              form={form}
              onSubmit={handleSubmit}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              Form for "{selectedBlock.type}" block is not yet implemented.
              <br />
              <br />
              Block props:
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                {JSON.stringify(selectedBlock.props, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
