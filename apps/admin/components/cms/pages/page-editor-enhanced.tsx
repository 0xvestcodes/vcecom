"use client";

import { closestCenter, DndContext, DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { BlockType } from "@vcecom/cms-blocks";
import { getBlockDefinition } from "@vcecom/cms-blocks";
import { ArrowLeft, Eye, Plus, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BlocksPreview } from "@/components/cms/blocks/preview/block-preview";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminContentTypes } from "@/hooks/cms/use-admin-content-types";
import { useAdminEntry } from "@/hooks/cms/use-admin-entries";
import { useAdminUpdateEntry } from "@/hooks/cms/use-admin-update-entry";
import type { Entry } from "@/lib/types/cms";
import { BlockSettingsPanel } from "./block-settings-panel";
import { BlocksPanel } from "./blocks-panel";
import type { Section } from "./section-editor";

interface PageEditorEnhancedProps {
  pageId: string;
}

/**
 * Enhanced 3-pane page editor (Shopify-like)
 * Left: Available blocks, Middle: Live preview, Right: Block settings
 */
export function PageEditorEnhanced({ pageId }: PageEditorEnhancedProps) {
  const router = useRouter();
  const { data: entry, isLoading: isLoadingEntry } = useAdminEntry(pageId);
  const { data: contentTypes } = useAdminContentTypes();
  const updateEntry = useAdminUpdateEntry(pageId, entry?.contentTypeId || "");

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Load structure from entry
  useEffect(() => {
    if (!entry) return;

    const entryWithStructure = entry as Entry & {
      structure?: { sections: Section[] };
    };
    if (
      entryWithStructure?.structure &&
      typeof entryWithStructure.structure === "object" &&
      "sections" in entryWithStructure.structure
    ) {
      setSections(
        (entryWithStructure.structure as { sections: Section[] }).sections ||
          [],
      );
    } else if (
      entry?.data.structure &&
      typeof entry.data.structure === "object" &&
      "sections" in entry.data.structure
    ) {
      setSections(
        (entry.data.structure as { sections: Section[] }).sections || [],
      );
    } else {
      // Default: single empty section
      setSections([
        {
          id: `section-${Date.now()}`,
          layout: "container",
          blocks: [],
        },
      ]);
    }
  }, [entry]);

  const handleSaveStructure = async () => {
    if (!entry) return;

    const structure = { sections };
    await updateEntry.mutateAsync({
      data: {
        ...entry.data,
        structure,
      },
    });
  };

  const handleAddBlock = (blockType: BlockType) => {
    // Add to first section, or create a section if none exists
    if (sections.length === 0) {
      setSections([
        {
          id: `section-${Date.now()}`,
          layout: "container",
          blocks: [
            {
              id: `block-${Date.now()}`,
              type: blockType,
              order: 0,
              props: getBlockDefinition(blockType)?.defaultProps || {},
            },
          ],
        },
      ]);
    } else {
      const firstSection = sections[0];
      const newBlock = {
        id: `block-${Date.now()}`,
        type: blockType,
        order: firstSection.blocks.length,
        props: getBlockDefinition(blockType)?.defaultProps || {},
      };
      setSections([
        {
          ...firstSection,
          blocks: [...firstSection.blocks, newBlock],
        },
        ...sections.slice(1),
      ]);
    }
  };

  const handleUpdateBlock = (
    blockId: string,
    updates: Partial<Section["blocks"][0]>,
  ) => {
    setSections(
      sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) =>
          block.id === blockId ? { ...block, ...updates } : block,
        ),
      })),
    );
  };

  const handleDeleteBlock = (blockId: string) => {
    setSections(
      sections.map((section) => ({
        ...section,
        blocks: section.blocks
          .filter((block) => block.id !== blockId)
          .map((block, idx) => ({ ...block, order: idx })),
      })),
    );
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find the section containing the dragged block
    const sourceSectionIndex = sections.findIndex((section) =>
      section.blocks.some((block) => block.id === active.id),
    );
    const targetSectionIndex = sections.findIndex((section) =>
      section.blocks.some((block) => block.id === over.id),
    );

    if (sourceSectionIndex === -1 || targetSectionIndex === -1) return;
    if (sourceSectionIndex !== targetSectionIndex) return; // Only reorder within same section for now

    const section = sections[sourceSectionIndex];
    const oldIndex = section.blocks.findIndex(
      (block) => block.id === active.id,
    );
    const newIndex = section.blocks.findIndex((block) => block.id === over.id);

    const newBlocks = arrayMove(section.blocks, oldIndex, newIndex);
    newBlocks.forEach((block, idx) => {
      block.order = idx;
    });

    setSections(
      sections.map((s, idx) =>
        idx === sourceSectionIndex ? { ...s, blocks: newBlocks } : s,
      ),
    );
  };

  // Get selected block
  const selectedBlock = selectedBlockId
    ? sections.flatMap((s) => s.blocks).find((b) => b.id === selectedBlockId) ||
      null
    : null;

  // Get all blocks for preview
  const allBlocks = sections.flatMap((section) => section.blocks);

  if (isLoadingEntry) {
    return (
      <AdminPageLayout title="Edit Page" description="Edit your CMS page">
        <div className="space-y-4">
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminPageLayout>
    );
  }

  if (!entry) {
    return (
      <AdminPageLayout
        title="Page Not Found"
        description="The page you're looking for doesn't exist"
      >
        <div className="text-center py-8">
          <p className="text-muted-foreground">Page not found</p>
          <Button asChild className="mt-4">
            <Link href="/cms/pages">Back to Pages</Link>
          </Button>
        </div>
      </AdminPageLayout>
    );
  }

  const pageTitle =
    (entry.data.title as string) ||
    (entry.data.name as string) ||
    "Untitled Page";

  return (
    <AdminPageLayout
      title={`Edit: ${pageTitle}`}
      description="Edit your CMS page content"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Pages", href: "/cms/pages" },
        { label: pageTitle },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/cms/pages">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button variant="outline">
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveStructure}
            disabled={updateEntry.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {updateEntry.isPending ? "Saving..." : "Save Draft"}
          </Button>
          <Button>
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
      }
    >
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
          {/* Left Pane: Available Blocks */}
          <div className="col-span-3">
            <BlocksPanel onAddBlock={handleAddBlock} />
          </div>

          {/* Middle Pane: Live Preview */}
          <div className="col-span-6 border-l border-r overflow-y-auto">
            <div className="p-4 border-b bg-muted/50">
              <h3 className="font-semibold text-sm">Live Preview</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Click a block to edit its settings
              </p>
            </div>
            <div className="p-4">
              {allBlocks.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="mb-2">No blocks yet</p>
                  <p className="text-sm">
                    Add blocks from the left panel to build your page
                  </p>
                </div>
              ) : (
                <SortableContext
                  items={allBlocks.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {allBlocks
                      .sort((a, b) => a.order - b.order)
                      .map((block) => (
                        <div
                          key={block.id}
                          onClick={() => setSelectedBlockId(block.id)}
                          className={`cursor-pointer rounded-lg border-2 transition-colors ${
                            selectedBlockId === block.id
                              ? "border-primary bg-primary/5"
                              : "border-transparent hover:border-muted"
                          }`}
                        >
                          <BlocksPreview blocks={[block]} />
                        </div>
                      ))}
                  </div>
                </SortableContext>
              )}
            </div>
          </div>

          {/* Right Pane: Block Settings */}
          <div className="col-span-3">
            <BlockSettingsPanel
              selectedBlock={selectedBlock}
              onUpdateBlock={handleUpdateBlock}
              onDeleteBlock={handleDeleteBlock}
            />
          </div>
        </div>
      </DndContext>
    </AdminPageLayout>
  );
}
