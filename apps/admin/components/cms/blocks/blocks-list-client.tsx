"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Reusable Blocks List Client
 * Shows all reusable content blocks
 */
export function BlocksListClient() {
  // TODO: Fetch reusable blocks from API
  const blocks: Array<{
    id: string;
    name: string;
    type: string;
    usedOn: number;
    updatedAt: Date;
  }> = [];

  return (
    <AdminPageLayout
      title="Content Blocks"
      description="Manage reusable content blocks"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Content Blocks" },
      ]}
      actions={
        <Button asChild>
          <Link href="/cms/blocks/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Block
          </Link>
        </Button>
      }
    >
      {blocks.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">No reusable blocks yet</p>
          <Button asChild>
            <Link href="/cms/blocks/create">
              <Plus className="mr-2 h-4 w-4" />
              Create First Block
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Used On</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks.map((block) => (
                <TableRow key={block.id}>
                  <TableCell className="font-medium">{block.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{block.type}</Badge>
                  </TableCell>
                  <TableCell>{block.usedOn} pages</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(block.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/cms/blocks/${block.id}/edit`}>Edit</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminPageLayout>
  );
}
