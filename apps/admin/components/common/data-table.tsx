"use client";

import { MoreHorizontal } from "lucide-react";
import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  header: string | ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface RowAction<T> {
  label: string;
  icon?: ReactNode;
  onClick: (row: T) => void;
  destructive?: boolean;
  disabled?: (row: T) => boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowActions?: RowAction<T>[];
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  getRowId?: (row: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
}

/**
 * Universal Data Table Component
 *
 * Replace all custom tables with one universal table:
 * - Column definitions via props
 * - Row actions via dropdown (3-dot menu)
 * - Selection for bulk actions
 * - Consistent styling and behavior
 * - Sortable columns
 * - Responsive design
 *
 * @example
 * ```tsx
 * <DataTable
 *   columns={[
 *     { id: 'name', header: 'Name', accessorKey: 'name' },
 *     { id: 'price', header: 'Price', cell: (row) => `$${row.price}` }
 *   ]}
 *   data={products}
 *   rowActions={[
 *     { label: 'Edit', onClick: (row) => router.push(`/products/${row.id}`) },
 *     { label: 'Delete', onClick: handleDelete, destructive: true }
 *   ]}
 *   selectable
 *   onSelectionChange={setSelectedIds}
 * />
 * ```
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowActions = [],
  onRowClick,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  getRowId = (row) => (row.id as string) || String(row),
  emptyMessage = "No items found",
  isLoading = false,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(data.map(getRowId));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (rowId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedRows, rowId]);
    } else {
      onSelectionChange(selectedRows.filter((id) => id !== rowId));
    }
  };

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
  };

  const allSelected = data.length > 0 && selectedRows.length === data.length;
  const someSelected =
    selectedRows.length > 0 && selectedRows.length < data.length;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-[50px]">
                  <Checkbox checked={false} disabled />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead key={column.id} style={{ width: column.width }}>
                  {column.header}
                </TableHead>
              ))}
              {rowActions.length > 0 && <TableHead className="w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {selectable && (
                  <TableCell>
                    <Checkbox disabled />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.id}>
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  </TableCell>
                ))}
                {rowActions.length > 0 && <TableCell />}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 p-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden transition-all duration-200">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead
                key={column.id}
                style={{ width: column.width }}
                className={cn(
                  column.sortable && "cursor-pointer hover:bg-muted/50",
                )}
                onClick={() => column.sortable && handleSort(column.id)}
              >
                <div className="flex items-center gap-2">
                  {column.header}
                  {column.sortable && sortColumn === column.id && (
                    <span className="text-xs">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </TableHead>
            ))}
            {rowActions.length > 0 && <TableHead className="w-[50px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const rowId = getRowId(row);
            const isSelected = selectedRows.includes(rowId);
            const destructiveActions = rowActions.filter((a) => a.destructive);
            const normalActions = rowActions.filter((a) => !a.destructive);

            return (
              <TableRow
                key={rowId}
                className={cn(
                  onRowClick && "cursor-pointer",
                  isSelected && "bg-muted/50",
                )}
                onClick={() => onRowClick?.(row)}
              >
                {selectable && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleSelectRow(rowId, checked as boolean)
                      }
                      aria-label={`Select row ${rowId}`}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.id}>
                    {column.cell
                      ? column.cell(row)
                      : column.accessorKey
                        ? String(row[column.accessorKey] ?? "")
                        : null}
                  </TableCell>
                ))}
                {rowActions.length > 0 && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {normalActions.map((action, index) => {
                          const disabled = action.disabled?.(row);
                          return (
                            <DropdownMenuItem
                              key={index}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!disabled) action.onClick(row);
                              }}
                              disabled={disabled}
                            >
                              {action.icon && (
                                <span className="mr-2">{action.icon}</span>
                              )}
                              {action.label}
                            </DropdownMenuItem>
                          );
                        })}
                        {destructiveActions.length > 0 &&
                          normalActions.length > 0 && <DropdownMenuSeparator />}
                        {destructiveActions.map((action, index) => {
                          const disabled = action.disabled?.(row);
                          return (
                            <DropdownMenuItem
                              key={index}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!disabled) action.onClick(row);
                              }}
                              disabled={disabled}
                              className="text-destructive focus:text-destructive"
                            >
                              {action.icon && (
                                <span className="mr-2">{action.icon}</span>
                              )}
                              {action.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
