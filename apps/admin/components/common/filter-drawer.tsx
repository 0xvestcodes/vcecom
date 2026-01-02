"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { FilterDefinition } from "@/lib/types/filters";

interface FilterDrawerProps {
  filters: FilterDefinition[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onClear: () => void;
  onApply: () => void;
}

/**
 * Universal Filter Drawer Component
 *
 * Single filter component used everywhere:
 * - Opens as Sheet from right
 * - Filter definitions via props
 * - Apply/Reset buttons
 * - URL state sync handled by parent
 *
 * @example
 * ```tsx
 * <FilterDrawer
 *   filters={[
 *     { key: 'status', label: 'Status', type: 'select', options: [...] },
 *     { key: 'price', label: 'Price Range', type: 'range' }
 *   ]}
 *   values={filterValues}
 *   onChange={setFilterValues}
 *   onClear={handleClearFilters}
 *   onApply={() => setOpen(false)}
 * />
 * ```
 */
export function FilterDrawer({
  filters,
  values,
  onChange,
  onClear,
  onApply,
}: FilterDrawerProps) {
  const handleFilterChange = (key: string, value: unknown) => {
    onChange({
      ...values,
      [key]: value === "" || value === "all" ? undefined : value,
    });
  };

  const renderFilterInput = (filter: FilterDefinition): ReactNode => {
    const value = values[filter.key];

    switch (filter.type) {
      case "text":
        return (
          <Input
            placeholder={filter.placeholder}
            value={(value as string) || ""}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
          />
        );

      case "select":
        return (
          <Select
            value={(value as string) || "all"}
            onValueChange={(val) => handleFilterChange(filter.key, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={filter.placeholder || "Select..."} />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "range":
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={(value as { min?: number; max?: number })?.min || ""}
              onChange={(e) =>
                handleFilterChange(filter.key, {
                  ...((value as { min?: number; max?: number }) || {}),
                  min: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="number"
              placeholder="Max"
              value={(value as { min?: number; max?: number })?.max || ""}
              onChange={(e) =>
                handleFilterChange(filter.key, {
                  ...((value as { min?: number; max?: number }) || {}),
                  max: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        );

      case "date":
        return (
          <Input
            type="date"
            value={(value as string) || ""}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
          />
        );

      case "dateRange":
        return (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              placeholder="From"
              value={
                ((value as { from?: string; to?: string })?.from as string) ||
                ""
              }
              onChange={(e) =>
                handleFilterChange(filter.key, {
                  ...((value as { from?: string; to?: string }) || {}),
                  from: e.target.value || undefined,
                })
              }
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              placeholder="To"
              value={
                ((value as { from?: string; to?: string })?.to as string) || ""
              }
              onChange={(e) =>
                handleFilterChange(filter.key, {
                  ...((value as { from?: string; to?: string }) || {}),
                  to: e.target.value || undefined,
                })
              }
            />
          </div>
        );

      case "boolean":
        return (
          <Select
            value={
              value === undefined ? "all" : value === true ? "true" : "false"
            }
            onValueChange={(val) =>
              handleFilterChange(
                filter.key,
                val === "all" ? undefined : val === "true",
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        );

      default:
        return null;
    }
  };

  const hasActiveFilters = Object.keys(values).some(
    (key) =>
      values[key] !== undefined && values[key] !== null && values[key] !== "",
  );

  return (
    <div className="space-y-6 py-4">
      {filters.map((filter) => (
        <div key={filter.key} className="space-y-2">
          <Label htmlFor={filter.key}>{filter.label}</Label>
          {renderFilterInput(filter)}
        </div>
      ))}

      <Separator />

      <div className="flex items-center justify-end gap-2">
        {hasActiveFilters && (
          <Button variant="outline" onClick={onClear}>
            Reset
          </Button>
        )}
        <Button onClick={onApply}>Apply Filters</Button>
      </div>
    </div>
  );
}
