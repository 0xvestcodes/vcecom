/**
 * Customer lifecycle event types
 */
export enum CustomerEventType {
  CUSTOMER_CREATED = "customer.created",
  CUSTOMER_UPDATED = "customer.updated",
  CUSTOMER_DELETED = "customer.deleted",
}

/**
 * Base customer event payload
 */
export interface BaseCustomerEventPayload {
  customerId: string;
  storeId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Customer created event payload
 */
export interface CustomerCreatedEventPayload extends BaseCustomerEventPayload {
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Customer updated event payload
 */
export interface CustomerUpdatedEventPayload extends BaseCustomerEventPayload {
  email: string;
  firstName?: string;
  lastName?: string;
  changes?: Record<string, unknown>; // Fields that were changed
}

/**
 * Customer deleted event payload
 */
export interface CustomerDeletedEventPayload extends BaseCustomerEventPayload {
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Union type for all customer event payloads
 */
export type CustomerEventPayload =
  | CustomerCreatedEventPayload
  | CustomerUpdatedEventPayload
  | CustomerDeletedEventPayload;
