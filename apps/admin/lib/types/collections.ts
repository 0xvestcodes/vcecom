export interface CollectionRule {
  field: "price" | "title" | "tags" | "category" | "status" | "inventory";
  operator: "equals" | "not_equals" | "less_than" | "greater_than" | "contains";
  value: string | number;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  type?: "manual" | "automatic";
  rules?: CollectionRule[];
  matchType?: "all" | "any";
  position?: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  productCount?: number;
}

export interface CollectionProduct {
  id: string;
  title: string;
  price: number;
  status: "draft" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionInput {
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  type?: "manual" | "automatic";
  rules?: CollectionRule[];
  matchType?: "all" | "any";
  position?: number;
}

export interface UpdateCollectionInput {
  name?: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  type?: "manual" | "automatic";
  rules?: CollectionRule[];
  matchType?: "all" | "any";
  position?: number;
}

export interface CollectionQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedCollectionsResponse {
  data: Collection[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AddProductsToCollectionInput {
  productIds: string[];
}

export interface AddProductsToCollectionResponse {
  message: string;
  added: number;
  skipped: number;
}

export interface CollectionPreviewResponse {
  count: number;
}
