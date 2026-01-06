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
import { Textarea } from "@/components/ui/textarea";
import {
  useRemoveFeatureFlagScope,
  useSetFeatureFlagScope,
} from "@/hooks/feature-flags/use-feature-flag-mutations";
import { useFeatureFlags } from "@/hooks/feature-flags/use-feature-flags";

interface FeatureFlagScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureKey: string;
}

export function FeatureFlagScopeDialog({
  open,
  onOpenChange,
  featureKey,
}: FeatureFlagScopeDialogProps) {
  const { data } = useFeatureFlags();
  const flag = data?.flags.find((f) => f.key === featureKey);
  const setScopeMutation = useSetFeatureFlagScope();
  const removeScopeMutation = useRemoveFeatureFlagScope();

  const [scopeType, setScopeType] = useState<"admin" | "store" | "environment">(
    "admin",
  );
  const [scopeId, setScopeId] = useState("");
  const [state, setState] = useState(true);
  const [reason, setReason] = useState("");

  const handleSave = async () => {
    if (!scopeId.trim()) {
      return;
    }

    await setScopeMutation.mutateAsync({
      key: featureKey,
      scopeType,
      scopeId: scopeId.trim(),
      state,
      reason: reason.trim() || undefined,
    });

    onOpenChange(false);
    // Reset form
    setScopeId("");
    setReason("");
  };

  const handleRemove = async () => {
    if (!flag?.activeScope) {
      return;
    }

    await removeScopeMutation.mutateAsync({
      key: featureKey,
      scopeType: flag.activeScope.type,
      scopeId: flag.activeScope.id,
      reason: reason.trim() || undefined,
    });

    onOpenChange(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Feature Flag Scope</DialogTitle>
          <DialogDescription>
            Set or remove scoped overrides for "{featureKey}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Scope Type</Label>
            <Select
              value={scopeType}
              onValueChange={(value) =>
                setScopeType(value as "admin" | "store" | "environment")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="store">Store</SelectItem>
                <SelectItem value="environment">Environment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              {scopeType === "admin"
                ? "Admin ID"
                : scopeType === "store"
                  ? "Store ID"
                  : "Environment Name"}
            </Label>
            <Input
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder={
                scopeType === "admin"
                  ? "Enter admin user ID"
                  : scopeType === "store"
                    ? "Enter store ID"
                    : "development, staging, production"
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={state} onCheckedChange={setState} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for this change (for audit log)"
              rows={3}
            />
          </div>

          {flag?.activeScope && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-sm font-medium mb-1">Current Override</p>
              <p className="text-xs text-muted-foreground">
                {flag.activeScope.type}: {flag.activeScope.id}
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-2"
                onClick={handleRemove}
                disabled={removeScopeMutation.isPending}
              >
                Remove Override
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!scopeId.trim() || setScopeMutation.isPending}
          >
            Save Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
