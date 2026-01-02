/**
 * Filter definition types for universal filter drawer
 */

export interface FilterOption {
  value: string;
  label: string;
}

export type FilterType =
  | "text"
  | "select"
  | "range"
  | "date"
  | "dateRange"
  | "boolean";

export interface FilterDefinition {
  key: string;
  label: string;
  type: FilterType;
  placeholder?: string;
  options?: FilterOption[];
}
