/**
 * Search document types
 * Defines the structure of documents indexed in search engines
 */

export type EntityType = "product" | "collection" | "variant";

export interface BaseSearchDocument {
  id: string;
  entityType: EntityType;
  indexedAt: string; // ISO timestamp
}

export interface ProductSearchDocument extends BaseSearchDocument {
  entityType: "product";
  title: string;
  description: string | null;
  slug: string | null;
  price: number;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  hsnCode: string | null;
  tags: string[];
  collections: string[]; // Collection IDs
  collectionNames: string[]; // Collection names for search
  variants: VariantSearchDocument[];
  imageUrl: string | null;
  isDigital: boolean;
  isPreorder: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface VariantSearchDocument {
  id: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  inventory: number;
  size: string | null;
  color: string | null;
  weight: number | null;
}

export interface CollectionSearchDocument extends BaseSearchDocument {
  entityType: "collection";
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  productCount: number;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export type SearchDocument = ProductSearchDocument | CollectionSearchDocument;
