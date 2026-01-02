"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";

interface BlockEditorProps {
  blockId: string;
}

/**
 * Block Editor for reusable blocks
 * Similar to page block editor but without page structure
 */
export function BlockEditor({ blockId: _blockId }: BlockEditorProps) {
  const [blockType, _setBlockType] = useState("rich_text");
  const [_blockData, _setBlockData] = useState<Record<string, unknown>>({});

  // TODO: Fetch block data from API

  return (
    <AdminPageLayout
      title="Edit Content Block"
      description="Edit reusable content block"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Content Blocks", href: "/cms/blocks" },
        { label: "Edit" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/cms/blocks">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Save Block
          </Button>
        </div>
      }
    >
      <div className="max-w-4xl">
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Block editor for reusable content blocks. This is a simplified
            version. Full block editing functionality will be implemented here.
          </p>
          <p className="text-xs text-muted-foreground">
            Block Type: {blockType}
          </p>
        </div>
      </div>
    </AdminPageLayout>
  );
}
