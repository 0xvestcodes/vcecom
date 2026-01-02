"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useCreateOrderNote } from "@/hooks/orders/use-admin-order-notes";

interface AddOrderNoteSheetProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Add Order Note Sheet Component
 *
 * Opens as Sheet from order actions
 * No full page redirects
 */
export function AddOrderNoteSheet({
  orderId,
  open,
  onOpenChange,
}: AddOrderNoteSheetProps) {
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const createNote = useCreateOrderNote();

  const handleSubmit = async () => {
    if (!note.trim()) return;

    try {
      await createNote.mutateAsync({
        orderId,
        note: note.trim(),
        isPublic,
      });
      setNote("");
      setIsPublic(false);
      onOpenChange(false);
    } catch (_error) {
      // Error handled by mutation hook
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add Note</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              placeholder="Add a note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={6}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-public"
              checked={isPublic}
              onCheckedChange={(checked) => setIsPublic(checked === true)}
            />
            <Label
              htmlFor="is-public"
              className="text-sm font-normal cursor-pointer"
            >
              Customer-visible note
            </Label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!note.trim() || createNote.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              {createNote.isPending ? "Adding..." : "Add Note"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
