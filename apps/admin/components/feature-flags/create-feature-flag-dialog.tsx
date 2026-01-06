"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateFeatureFlag } from "@/hooks/feature-flags/use-feature-flag-mutations";

interface CreateFeatureFlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFeatureFlagDialog({
  open,
  onOpenChange,
}: CreateFeatureFlagDialogProps) {
  const createMutation = useCreateFeatureFlag();

  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"global" | "store" | "admin" | "env">(
    "global",
  );
  const [defaultState, setDefaultState] = useState(false);

  const handleCreate = async () => {
    if (!key.trim() || !description.trim()) {
      return;
    }

    await createMutation.mutateAsync({
      key: key.trim().toLowerCase().replace(/\s+/g, "_"),
      description: description.trim(),
      type,
      defaultState,
    });

    // Reset form
    setKey("");
    setDescription("");
    setType("global");
    setDefaultState(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Feature Flag</DialogTitle>
          <DialogDescription>
            Register a new feature flag in the system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Key</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="returns_module"
              pattern="[a-z0-9_]+"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and underscores only
            </p>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enable returns and refunds module"
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(value) =>
                setType(value as "global" | "store" | "admin" | "env")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="store">Store</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="env">Environment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Default State</Label>
              <Switch
                checked={defaultState}
                onCheckedChange={setDefaultState}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Default enabled/disabled state when no overrides are set
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              !key.trim() ||
              !description.trim() ||
              createMutation.isPending ||
              !/^[a-z0-9_]+$/.test(key.trim())
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
