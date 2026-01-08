export interface MediaGroup {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  imageCount?: number;
}

export interface MediaItem {
  id: string;
  groupId: string;
  storageKey: string;
  url: string;
  altText?: string | null;
  caption?: string | null;
  displayOrder: number;
  linkUrl?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMediaGroupInput {
  name: string;
  slug?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateMediaGroupInput {
  name?: string;
  slug?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateMediaItemInput {
  groupId: string;
  storageKey: string;
  url: string;
  altText?: string;
  caption?: string;
  displayOrder?: number;
  linkUrl?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateMediaItemInput {
  altText?: string;
  caption?: string;
  displayOrder?: number;
  linkUrl?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MediaGroupQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface PaginatedMediaGroupsResponse {
  data: MediaGroup[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ReorderItemsInput {
  itemIds: string[];
}
