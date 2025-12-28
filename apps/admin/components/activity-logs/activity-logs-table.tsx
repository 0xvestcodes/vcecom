"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActivityLog } from "@/lib/types/activity-logs";
import { ActivityLogRow } from "./activity-log-row";

interface ActivityLogsTableProps {
  logs: ActivityLog[];
  isLoading?: boolean;
}

export function ActivityLogsTable({
  logs,
  isLoading = false,
}: ActivityLogsTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>User Agent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => (
              <TableRow key={`activity-log-skeleton-row-${String(i)}`}>
                <TableCell colSpan={7}>
                  <div className="h-10 bg-muted/30 animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/30 p-8 text-center">
        <p className="text-xs text-muted-foreground">No activity logs found</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Timestamp</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Resource</TableHead>
            <TableHead>Entity ID</TableHead>
            <TableHead>User Agent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <ActivityLogRow key={log.id} log={log} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
