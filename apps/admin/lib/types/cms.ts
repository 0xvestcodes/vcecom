/**
 * CMS-related TypeScript types
 * Mapped from backend DTOs
 */

export type EntryStatus = "draft" | "published";
export type WorkflowStatus = "draft" | "review" | "published";

export interface FieldDefinition {
  name: string;
  type:
    | "text"
    | "number"
    | "rich_text"
    | "rich_text_lexical"
    | "image"
    | "boolean"
    | "select"
    | "relation";
  required?: boolean;
  default?: unknown;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  options?: string[];
  relationType?: "one_to_one" | "one_to_many" | "many_to_many";
  relationContentTypeId?: string;
  visibleInList?: boolean;
}

export interface ContentTypeSchema {
  fields: FieldDefinition[];
  displayFields?: string[];
  validation?: {
    slug?: {
      unique?: boolean;
      pattern?: string;
    };
  };
}

export interface ContentType {
  id: string;
  name: string;
  displayName: string;
  schema: ContentTypeSchema;
  isSingleton: boolean;
  isCollection: boolean;
  icon?: string | null;
  color?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  entryCount?: number;
}

export interface Entry {
  id: string;
  contentTypeId: string;
  status: EntryStatus; // Legacy field
  currentWorkflowStatus?: WorkflowStatus; // New workflow status
  data: Record<string, unknown>;
  slug?: string | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  snapshot?: {
    id: string;
    snapshotType: "draft" | "review" | "published";
    snapshotNumber?: number;
    data: Record<string, unknown>;
  };
}

export interface EntryRevision {
  id: string;
  entryId: string;
  revisionNumber: number;
  data: Record<string, unknown>;
  createdAt: Date;
  createdBy?: string | null;
}

export interface PaginatedEntriesResponse {
  data: Entry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListEntriesQueryParams {
  page?: number;
  limit?: number;
  status?: EntryStatus | WorkflowStatus;
  search?: string;
  sortBy?: "newest" | "oldest" | "alphabetical";
}

export interface CreateContentTypeDto {
  name: string;
  displayName: string;
  schema: ContentTypeSchema;
  isSingleton?: boolean;
  isCollection?: boolean;
  icon?: string;
  color?: string;
}

export interface UpdateContentTypeDto {
  name?: string;
  displayName?: string;
  schema?: ContentTypeSchema;
  isSingleton?: boolean;
  isCollection?: boolean;
  icon?: string | null;
  color?: string | null;
}

export interface CreateEntryDto {
  contentTypeId: string;
  data: Record<string, unknown>;
  status?: EntryStatus;
  slug?: string;
}

export interface UpdateEntryDto {
  data?: Record<string, unknown>;
  status?: EntryStatus;
  slug?: string | null;
}

// Alias for Entry (used in some components)
export type CmsEntry = Entry;

// Block type for CMS pages
export interface Block {
  id: string;
  type: string;
  props: Record<string, unknown>;
  style?: Record<string, unknown>;
  order?: number;
}
