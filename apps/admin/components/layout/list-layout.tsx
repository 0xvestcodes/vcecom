"use client";

import { Filter, Plus } from "lucide-react";
import { ReactNode, useState } from "react";
import { FilterDrawer } from "@/components/common/filter-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { FilterDefinition } from "@/lib/types/filters";

interface ListLayoutProps {
  title: string;
  description?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  createButton?: ReactNode;
  createButtonLabel?: string;
  onCreateClick?: () => void;
  filters?: FilterDefinition[];
  filterValues?: Record<string, unknown>;
  onFiltersChange?: (filters: Record<string, unknown>) => void;
  onClearFilters?: () => void;
  children: ReactNode;
  pagination?: ReactNode;
  bulkActions?: ReactNode;
  selectedCount?: number;
}

/**
 * Universal List Layout Component
 *
 * Provides consistent structure for all list pages:
 * - Standardized header with title, description, and primary action button
 * - Universal filter drawer (opens from right)
 * - Consistent table structure
 * - Standardized pagination
 * - Bulk actions bar
 *
 * @example
 * ```tsx
 * <ListLayout
 *   title="Products"
 *   description="Manage your product catalog"
 *   searchPlaceholder="Search products..."
 *   createButtonLabel="Create Product"
 *   onCreateClick={() => setCreateSheetOpen(true)}
 *   filters={productFilters}
 *   pagination={<PaginationControls />}
 * >
 *   <DataTable columns={columns} data={products} />
 * </ListLayout>
 * ```
 */
export function ListLayout({
  title,
  description,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  createButton,
  createButtonLabel,
  onCreateClick,
  filters = [],
  filterValues = {},
  onFiltersChange,
  onClearFilters,
  children,
  pagination,
  bulkActions,
  selectedCount = 0,
}: ListLayoutProps) {
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const hasActiveFilters =
    filters.length > 0 && Object.keys(filterValues).length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {createButton ||
            (onCreateClick && (
              <Button onClick={onCreateClick}>
                <Plus className="mr-2 h-4 w-4" />
                {createButtonLabel || "Create"}
              </Button>
            ))}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex items-center gap-2">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px]">
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        )}

        {filters.length > 0 && (
          <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <FilterDrawer
                filters={filters}
                values={filterValues}
                onChange={onFiltersChange || (() => {})}
                onClear={onClearFilters}
                onApply={() => setFilterDrawerOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedCount > 0 && bulkActions && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedCount} selected
            </span>
            {bulkActions}
          </div>
        </div>
      )}

      {/* Content */}
      <div>{children}</div>

      {/* Pagination */}
      {pagination && (
        <div className="flex justify-center pt-2">{pagination}</div>
      )}
    </div>
  );
}
