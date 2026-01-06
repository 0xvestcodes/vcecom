"use client";

import { History, Settings } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUpdateFeatureFlagDefaultState } from "@/hooks/feature-flags/use-feature-flag-mutations";
import type { FeatureFlag } from "@/hooks/feature-flags/use-feature-flags";
import { FeatureFlagHistoryDialog } from "./feature-flag-history-dialog";

interface FeatureFlagRowProps {
  flag: FeatureFlag;
  onManageScope: () => void;
}

export function FeatureFlagRow({ flag, onManageScope }: FeatureFlagRowProps) {
  const updateDefaultStateMutation = useUpdateFeatureFlagDefaultState();
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  const handleToggle = async (checked: boolean) => {
    await updateDefaultStateMutation.mutateAsync({
      key: flag.key,
      state: checked,
    });
  };

  const scopeBadge = flag.activeScope ? (
    <Badge variant="secondary" className="text-xs">
      {flag.activeScope.type}: {flag.activeScope.id.substring(0, 8)}...
    </Badge>
  ) : (
    <span className="text-xs text-muted-foreground">Default</span>
  );

  const scopeTooltip = flag.activeScope
    ? `This feature is overridden at ${flag.activeScope.type} level`
    : "Using default state";

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs">{flag.key}</TableCell>
        <TableCell className="text-sm">{flag.description}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {flag.type}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Switch
              checked={flag.defaultState}
              onCheckedChange={handleToggle}
              disabled={updateDefaultStateMutation.isPending}
            />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Badge
              variant={flag.currentState ? "default" : "secondary"}
              className="text-xs"
            >
              {flag.currentState ? "Enabled" : "Disabled"}
            </Badge>
            {flag.activeScope && flag.currentState !== flag.defaultState && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-xs">
                      Override
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Current state differs from default due to{" "}
                      {flag.activeScope.type} override
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </TableCell>
        <TableCell>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>{scopeBadge}</TooltipTrigger>
              <TooltipContent>
                <p>{scopeTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHistoryDialogOpen(true)}
              title="View history"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onManageScope}
              title="Manage scope"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <FeatureFlagHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        featureKey={flag.key}
      />
    </>
  );
}
