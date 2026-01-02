"use client";

import { FolderOpen, Plus } from "lucide-react";
import { ProtectedButton } from "@/components/common/protected-button";
import { Button } from "@/components/ui/button";

interface EmptyCollectionsStateProps {
  onCreate?: () => void;
}

export function EmptyCollectionsState({
  onCreate,
}: EmptyCollectionsStateProps) {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
      <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">No collections found</p>
      <p className="text-xs mb-4">
        Create your first collection to get started
      </p>
      {onCreate && (
        <ProtectedButton requiredRoles={["admin", "marketing"]}>
          <Button onClick={onCreate} size="sm">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Create Collection
          </Button>
        </ProtectedButton>
      )}
    </div>
  );
}
