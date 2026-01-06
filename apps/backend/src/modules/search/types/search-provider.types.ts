/**
 * Search provider types
 * Common types used across all search providers
 */

import type { SearchDocument } from "./search-document.types";

// Re-export SearchDocument for use in other modules
export type { SearchDocument } from "./search-document.types";

export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  sort?: SearchSort[];
  page?: number;
  limit?: number;
  facets?: string[];
}

export interface SearchFilters {
  categoryId?: string;
  collectionId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  status?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface SearchSort {
  field: string;
  direction: "asc" | "desc";
}

export interface SearchResult<T extends SearchDocument = SearchDocument> {
  document: T;
  score?: number;
  highlights?: Record<string, string[]>;
}

export interface SearchResponse<T extends SearchDocument = SearchDocument> {
  results: SearchResult<T>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets?: Record<string, FacetValue[]>;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface IndexStats {
  documentCount: number;
  indexSize: number; // in bytes
  lastIndexedAt: string | null; // ISO timestamp
}

export interface IndexOptions {
  indexName?: string;
  settings?: IndexSettings;
}

export interface IndexSettings {
  searchableAttributes?: string[];
  filterableAttributes?: string[];
  sortableAttributes?: string[];
  rankingRules?: string[];
  synonyms?: Record<string, string[]>;
  stopWords?: string[];
  [key: string]: unknown;
}

export interface BatchIndexResult {
  success: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}
