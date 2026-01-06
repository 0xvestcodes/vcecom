/**
 * Product lifecycle event types
 */
export enum ProductEventType {
  PRODUCT_CREATED = "product.created",
  PRODUCT_UPDATED = "product.updated",
  PRODUCT_DELETED = "product.deleted",
  PRODUCT_PUBLISHED = "product.published",
  PRODUCT_UNPUBLISHED = "product.unpublished",
}

/**
 * Base product event payload
 */
export interface BaseProductEventPayload {
  productId: string;
  storeId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Product created event payload
 */
export interface ProductCreatedEventPayload extends BaseProductEventPayload {
  title: string;
  handle?: string;
  status: string;
}

/**
 * Product updated event payload
 */
export interface ProductUpdatedEventPayload extends BaseProductEventPayload {
  title: string;
  handle?: string;
  status: string;
  changes?: Record<string, unknown>; // Fields that were changed
}

/**
 * Product deleted event payload
 */
export interface ProductDeletedEventPayload extends BaseProductEventPayload {
  title: string;
  handle?: string;
}

/**
 * Product published event payload
 */
export interface ProductPublishedEventPayload extends BaseProductEventPayload {
  title: string;
  handle?: string;
  publishedAt: Date;
}

/**
 * Product unpublished event payload
 */
export interface ProductUnpublishedEventPayload
  extends BaseProductEventPayload {
  title: string;
  handle?: string;
}

/**
 * Union type for all product event payloads
 */
export type ProductEventPayload =
  | ProductCreatedEventPayload
  | ProductUpdatedEventPayload
  | ProductDeletedEventPayload
  | ProductPublishedEventPayload
  | ProductUnpublishedEventPayload;
