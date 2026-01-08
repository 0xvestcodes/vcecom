"use client";

import { Edit, ExternalLink, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminDeleteMediaItem } from "@/hooks/media-groups/use-admin-delete-media-item";
import type { MediaItem } from "@/lib/types/media-groups";
import { EditMediaItemDialog } from "./edit-media-item-dialog";

interface MediaItemsTableProps {
  items: MediaItem[];
  groupId: string;
  isLoading?: boolean;
}

export function MediaItemsTable({
  items,
  groupId,
  isLoading,
}: MediaItemsTableProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const deleteItem = useAdminDeleteMediaItem(groupId);

  const handleEdit = (item: MediaItem) => {
    setSelectedItem(item);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (item: MediaItem) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedItem) {
      try {
        await deleteItem.mutateAsync(selectedItem.id);
        setDeleteDialogOpen(false);
        setSelectedItem(null);
      } catch (_error) {
        // Error handled by hook
      }
    }
  };

  if (isLoading) {
    return <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
        <p className="text-sm font-medium mb-1">No images in this group</p>
        <p className="text-xs">
          Upload images via Storage, then add them to this group
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Image</TableHead>
              <TableHead>Alt Text</TableHead>
              <TableHead>Caption</TableHead>
              <TableHead>Link URL</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="relative h-16 w-16 rounded overflow-hidden border">
                    <Image
                      src={item.url}
                      alt={item.altText || "Media item"}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {item.altText || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {item.caption || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  {item.linkUrl ? (
                    <a
                      href={item.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {item.linkUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{item.displayOrder}</span>
                </TableCell>
                <TableCell>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      item.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    }`}
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(item)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditMediaItemDialog
        item={selectedItem}
        groupId={groupId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedItem(null);
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Image"
        description="Are you sure you want to remove this image from the group?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteItem.isPending}
      />
    </>
  );
}
