"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFeatureFlagHistory } from "@/hooks/feature-flags/use-feature-flags";

interface FeatureFlagHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureKey: string;
}

export function FeatureFlagHistoryDialog({
  open,
  onOpenChange,
  featureKey,
}: FeatureFlagHistoryDialogProps) {
  const { data, isLoading } = useFeatureFlagHistory(featureKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feature Flag History</DialogTitle>
          <DialogDescription>Audit log for "{featureKey}"</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">
            Loading history...
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Old State</TableHead>
                  <TableHead>New State</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.history.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No history available
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs">
                        {format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {entry.scopeType && entry.scopeId ? (
                          <Badge variant="outline" className="text-xs">
                            {entry.scopeType}: {entry.scopeId.substring(0, 8)}
                            ...
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Global
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.oldState !== undefined ? (
                          <Badge
                            variant={entry.oldState ? "default" : "secondary"}
                          >
                            {entry.oldState ? "Enabled" : "Disabled"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={entry.newState ? "default" : "secondary"}
                        >
                          {entry.newState ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {entry.changedBy.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.changeReason || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
