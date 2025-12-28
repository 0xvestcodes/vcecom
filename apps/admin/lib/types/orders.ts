/**
 * Order-related TypeScript types
 * Mapped from backend DTOs
 */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "initiated"
  | "completed"
  | "failed"
  | "refunded";

export type FulfillmentStatus =
  | "unfulfilled"
  | "partially_fulfilled"
  | "fulfilled"
  | "shipped"
  | "delivered";

export interface GSTBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  isIntraState: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  quantity: number;
  price: number;
  gstRate: number;
  gstAmount: number;
  createdAt: Date;
  updatedAt: Date;
  // Extended fields (may come from product lookup)
  productTitle?: string;
  variantTitle?: string;
  thumbnail?: string;
  // Bundle fields
  bundleId?: string;
  bundleTitle?: string;
  bundleVariantBreakdown?: Array<{
    variantId: string;
    unitPrice: number;
    quantity: number;
  }>;
}

export interface Order {
  id: string;
  customerId: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  gstAmount: number;
  gstBreakdown: GSTBreakdown;
  discountCode?: string | null;
  discountAmount: number;
  shippingCost: number;
  paymentFee?: number; // Payment fee in paise
  paymentFeeBreakdown?: {
    method: string;
    chargeType: "FLAT" | "PERCENTAGE" | "MIXED";
    calculatedFee: number;
    flatAmount?: number;
    percentage?: number;
    mixMin?: number;
    mixCap?: number;
  } | null;
  paymentMethod?: string | null;
  total: number;
  razorpayOrderId: string | null;
  shippingProvider: string | null;
  shippingAddressId: string;
  billingAddressId: string;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
  // Extended fields (may come from customer/address lookup)
  customerName?: string;
  customerEmail?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  // Snapshots
  discountSnapshot?: Record<string, unknown> | null;
  pricingSnapshot?: Record<string, unknown> | null;
  // Abandoned checkout
  abandonedCheckoutId?: string | null;
  recoverySource?: "email" | "whatsapp" | null;
  recoveredAt?: Date | null;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  landmark?: string | null;
  type: "shipping" | "billing";
}

export interface PaginatedOrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type OrderSortBy = "createdAt" | "total" | "orderNumber";
export type OrderSortOrder = "asc" | "desc";

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  minValue?: number;
  maxValue?: number;
  paymentMethod?: "COD" | "prepaid" | "all";
  // Note: sortBy and sortOrder are temporarily removed as backend doesn't support them yet
  // sortBy?: OrderSortBy;
  // sortOrder?: OrderSortOrder;
}

export type TimelineEventType =
  | "order_created"
  | "status_changed"
  | "payment_intent_created"
  | "payment_initiated"
  | "payment_completed"
  | "payment_failed"
  | "cart_snapshot"
  | "inventory_reserved"
  | "shipment_created"
  | "shipment_label_generated"
  | "shipment_picked_up"
  | "shipment_in_transit"
  | "shipment_out_for_delivery"
  | "shipment_delivered"
  | "shipment_failed"
  | "shipment_returned"
  | "shipment_cancelled"
  | "note_added"
  | "admin_note_added"
  | "address_updated"
  | "refund_created"
  | "refund_processed"
  | "rate_limit_triggered"
  | "checkout_merged"
  | "guest_checkout_detected"
  | "abandoned_checkout_recovered";

export type TimelineActor = "system" | "admin" | "customer" | "automated";

export interface TimelineEvent {
  type: TimelineEventType;
  title: string;
  description: string;
  previousValue?: string | null;
  newValue?: string | null;
  timestamp: Date;
  actor?: TimelineActor;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  metadata?: Record<string, unknown> | null;
  traceId?: string;
  spanId?: string;
  requestId?: string;
}

export interface OrderTimeline {
  orderId: string;
  orderNumber: string;
  currentStatus: OrderStatus;
  events: TimelineEvent[];
}
