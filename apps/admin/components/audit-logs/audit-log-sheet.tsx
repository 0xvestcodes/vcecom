"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DateTime } from "../orders/date-time";

interface AuditLogSheetProps {
  logId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Audit Log Sheet Component (L3 pattern)
 *
 * View audit log details via Sheet
 * Opens from audit logs list
 */
export function AuditLogSheet({
  logId: _logId,
  open,
  onOpenChange,
}: AuditLogSheetProps) {
  // TODO: Fetch log details from API using _logId
  const log = null; // Placeholder

  if (!log) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>Audit Log Details</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <div className="space-y-4 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Log Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Timestamp</div>
                  <DateTime date={new Date()} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Admin</div>
                  <div className="font-medium">-</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Action</div>
                  <Badge variant="outline">-</Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Resource</div>
                  <div className="font-medium">-</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
