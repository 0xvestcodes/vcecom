"use client";

import { formatDistanceToNow } from "date-fns";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * CMS Logs Client
 * Shows CMS activity logs
 */
export function CmsLogsClient() {
  // TODO: Fetch logs from API
  const logs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    timestamp: Date;
    userId?: string;
  }> = [];

  return (
    <AdminPageLayout
      title="CMS Logs"
      description="Activity log for CMS operations"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Logs" },
      ]}
    >
      {logs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No logs available</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.entityType} ({log.entityId.slice(0, 8)}...)
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.userId || "System"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(log.timestamp), {
                      addSuffix: true,
                    })}
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
