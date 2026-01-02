"use client";

import { BlockDataEditor } from "./block-data-editor";

interface Block {
  id: string;
  type: string;
  data: Record<string, unknown>;
  visible: boolean;
}

interface PageEditorPaneProps {
  blocks: Block[];
  selectedBlockId: string | null;
  onBlocksChange: (blocks: Block[]) => void;
}

/**
 * Middle pane: Block editor
 * Shows the selected block's editor
 */
export function PageEditorPane({
  blocks,
  selectedBlockId,
  onBlocksChange,
}: PageEditorPaneProps) {
  const selectedBlock = blocks.find((block) => block.id === selectedBlockId);

  if (!selectedBlockId || !selectedBlock) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div>
          <p className="text-muted-foreground mb-2">No block selected</p>
          <p className="text-sm text-muted-foreground">
            Select a block from the left panel to edit it
          </p>
        </div>
      </div>
    );
  }

  const handleBlockChange = (data: Record<string, unknown>) => {
    onBlocksChange(
      blocks.map((block) =>
        block.id === selectedBlockId ? { ...block, data } : block,
      ),
    );
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h3 className="font-semibold text-sm mb-1">
          Editing: {selectedBlock.type.replace(/_/g, " ")}
        </h3>
        <p className="text-xs text-muted-foreground">
          Block ID: {selectedBlock.id}
        </p>
      </div>

      <div className="border rounded-lg p-4">
        <BlockDataEditor
          blockType={selectedBlock.type}
          blockData={selectedBlock.data}
          onChange={handleBlockChange}
        />
      </div>
    </div>
  );
}
