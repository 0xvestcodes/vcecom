"use client";

import { ArrowLeft, Eye, Plus, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BlocksPreview } from "@/components/cms/blocks/preview/block-preview";
import { LivePreviewPanel } from "@/components/cms/preview/live-preview-panel";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminContentTypes } from "@/hooks/cms/use-admin-content-types";
import { useAdminEntry } from "@/hooks/cms/use-admin-entries";
import { useAdminUpdateEntry } from "@/hooks/cms/use-admin-update-entry";
import type { Entry } from "@/lib/types/cms";
import { PageMetaPane } from "./page-meta-pane";
import { type Section, SectionEditor } from "./section-editor";

interface PageEditorProps {
  pageId: string;
}

/**
 * Main 3-pane page editor component
 * Left: Blocks structure, Middle: Block editor, Right: Meta/SEO
 */
export function PageEditor({ pageId }: PageEditorProps) {
  const _router = useRouter();
  const { data: entry, isLoading: isLoadingEntry } = useAdminEntry(pageId);
  const { data: contentTypes } = useAdminContentTypes();
  const updateEntry = useAdminUpdateEntry(pageId, entry?.contentTypeId || "");

  const _pageContentType = contentTypes?.find(
    (ct) => ct.name === "page" || ct.displayName.toLowerCase() === "page",
  );

  // State for live preview - must be declared before early returns
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Load structure from entry.data.structure or entry.structure
  const [sections, setSections] = useState<Section[]>(() => {
    const entryWithStructure = entry as Entry & {
      structure?: { sections: Section[] };
    };
    if (
      entryWithStructure?.structure &&
      typeof entryWithStructure.structure === "object" &&
      "sections" in entryWithStructure.structure
    ) {
      return (
        (entryWithStructure.structure as { sections: Section[] }).sections || []
      );
    }
    if (
      entry?.data.structure &&
      typeof entry.data.structure === "object" &&
      "sections" in entry.data.structure
    ) {
      return (entry.data.structure as { sections: Section[] }).sections || [];
    }
    // Default: single empty section
    return [
      {
        id: `section-${Date.now()}`,
        layout: "container",
        blocks: [],
      },
    ];
  });

  // Update sections when entry changes
  useEffect(() => {
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

  const handleAddSection = () => {
    setSections([
      ...sections,
      {
        id: `section-${Date.now()}`,
        layout: "container",
        blocks: [],
      },
    ]);
  };

  const handleUpdateSection = (sectionId: string, updatedSection: Section) => {
    setSections(sections.map((s) => (s.id === sectionId ? updatedSection : s)));
  };

  const handleDeleteSection = (sectionId: string) => {
    setSections(sections.filter((s) => s.id !== sectionId));
  };

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

  // Update entry structure when sections change (for live preview)
  const entryWithUpdatedStructure = {
    ...entry,
    data: {
      ...entry.data,
      structure: { sections },
    },
  };

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
          <Button
            variant={showLivePreview ? "default" : "outline"}
            onClick={() => setShowLivePreview(!showLivePreview)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {showLivePreview ? "Hide Preview" : "Live Preview"}
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
      {showLivePreview ? (
        <div className="h-[calc(100vh-200px)]">
          <LivePreviewPanel
            entry={entryWithUpdatedStructure}
            contentTypeName="page"
            defaultOpen
            className="h-full"
          />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
          {/* Left Pane: Sections List */}
          <div className="col-span-2 border-r flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm mb-2">Page Sections</h3>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleAddSection}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {sections.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No sections yet. Click "Add Section" to get started.
                  </div>
                ) : (
                  sections.map((section, index) => (
                    <div
                      key={section.id}
                      className="p-2 border rounded-lg cursor-pointer hover:bg-accent/50"
                    >
                      <p className="text-sm font-medium">Section {index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        {section.blocks.length} block
                        {section.blocks.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Middle Pane: Section Editor */}
          <div className="col-span-5 overflow-y-auto">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                {sections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No sections. Add a section to start building your page.
                  </div>
                ) : (
                  sections.map((section) => (
                    <SectionEditor
                      key={section.id}
                      section={section}
                      onUpdate={(updated) =>
                        handleUpdateSection(section.id, updated)
                      }
                      onDelete={
                        sections.length > 1
                          ? () => handleDeleteSection(section.id)
                          : undefined
                      }
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Preview Pane: Block Preview */}
          <div className="col-span-3 border-l overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm mb-2">Block Preview</h3>
              <p className="text-xs text-muted-foreground">
                Visual preview of blocks
              </p>
            </div>
            <ScrollArea className="h-full">
              <div className="p-4">
                {sections.map((section) => (
                  <div key={section.id} className="mb-8">
                    <BlocksPreview blocks={section.blocks} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right Pane: Meta/SEO */}
          <div className="col-span-2 border-l">
            <PageMetaPane entry={entry} />
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
