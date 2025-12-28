"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Search } from "lucide-react";
import { useState } from "react";
import { PaginationControls } from "@/components/common/pagination-controls";
import { QueryState } from "@/components/common/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, FetchError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  ipAddress?: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

interface AuditLogsFilters {
  resourceType?: string;
  adminId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export function AuditLogsPageClient() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditLogsFilters>({});
  const limit = 20;

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["audit-logs", page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters.resourceType) {
        params.append("resourceType", filters.resourceType);
      }
      if (filters.adminId) {
        params.append("adminId", filters.adminId);
      }
      if (filters.action) {
        params.append("action", filters.action);
      }
      if (filters.startDate) {
        params.append("startDate", filters.startDate.toISOString());
      }
      if (filters.endDate) {
        params.append("endDate", filters.endDate.toISOString());
      }
      if (filters.search) {
        params.append("search", filters.search);
      }

      return apiFetch<AuditLogsResponse>(
        `/admin/audit-logs?${params.toString()}`,
      );
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={filters.search || ""}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              className="pl-8"
            />
          </div>
        </div>

        <Select
          value={filters.resourceType || "all"}
          onValueChange={(value) =>
            setFilters({
              ...filters,
              resourceType: value === "all" ? undefined : value,
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Resource Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="order">Order</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="discount">Discount</SelectItem>
            <SelectItem value="price-list">Price List</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.action || "all"}
          onValueChange={(value) =>
            setFilters({
              ...filters,
              action: value === "all" ? undefined : value,
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !filters.startDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.startDate ? (
                format(filters.startDate, "PPP")
              ) : (
                <span>Start Date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.startDate}
              onSelect={(date) => setFilters({ ...filters, startDate: date })}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !filters.endDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.endDate ? (
                format(filters.endDate, "PPP")
              ) : (
                <span>End Date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.endDate}
              onSelect={(date) => setFilters({ ...filters, endDate: date })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <QueryState
        isLoading={isLoading}
        error={queryError ? (queryError as FetchError) : null}
        data={data}
        isEmpty={(d) => d?.logs.length === 0}
        emptyComponent={
          <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
            <p className="text-sm font-medium mb-1">No audit logs found</p>
            <p className="text-xs">
              Audit logs will appear here as changes are made
            </p>
          </div>
        }
      >
        <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Changes</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.logs.map((log) => (
                <AuditLogRow key={log.id} log={log} />
              ))}
            </TableBody>
          </Table>
        </div>

        {data && (
          <PaginationControls
            paginationInfo={{
              startItem: (page - 1) * limit + 1,
              endItem: Math.min(page * limit, data.total),
              total: data.total,
              currentPage: page,
              totalPages: Math.ceil(data.total / limit),
            }}
            onPreviousPage={() => setPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setPage((p) => p + 1)}
            canGoPrevious={page > 1}
            canGoNext={page < Math.ceil(data.total / limit)}
            itemLabel="logs"
          />
        )}
      </QueryState>
    </div>
  );
}

function AuditLogRow({ log }: { log: AuditLog }) {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <>
      <TableRow
        className="group cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setShowDiff(!showDiff)}
      >
        <TableCell className="text-xs">
          {format(new Date(log.createdAt), "PPp")}
        </TableCell>
        <TableCell className="text-xs">
          <div>
            <div className="font-medium">{log.adminEmail}</div>
            {log.adminId && (
              <div className="text-xs text-muted-foreground">{log.adminId}</div>
            )}
          </div>
        </TableCell>
        <TableCell className="text-xs">
          <Badge variant="outline" className="text-xs">
            {log.action}
          </Badge>
        </TableCell>
        <TableCell className="text-xs">
          <div>
            <div className="font-medium">{log.resourceType}</div>
            <div className="text-xs text-muted-foreground">
              {log.resourceId}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-xs">
          {log.changes && log.changes.length > 0 ? (
            <Button variant="link" size="sm" className="text-xs h-8">
              {log.changes.length} change{log.changes.length !== 1 ? "s" : ""}
            </Button>
          ) : (
            <span className="text-muted-foreground">No changes</span>
          )}
        </TableCell>
        <TableCell className="text-xs">
          {log.ipAddress ? (
            <code className="text-xs">{log.ipAddress}</code>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {showDiff && log.changes && log.changes.length > 0 && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/50">
            <div className="space-y-2 p-4">
              <div className="font-semibold">Changes:</div>
              {log.changes.map((change) => (
                <div key={change.field} className="text-sm">
                  <div className="font-medium">{change.field}:</div>
                  <div className="grid grid-cols-2 gap-4 mt-1">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Old Value:
                      </div>
                      <code className="text-xs bg-destructive/10 p-1 rounded">
                        {JSON.stringify(change.oldValue)}
                      </code>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        New Value:
                      </div>
                      <code className="text-xs bg-green-500/10 p-1 rounded">
                        {JSON.stringify(change.newValue)}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
