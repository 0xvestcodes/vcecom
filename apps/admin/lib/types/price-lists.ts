/**
 * Price List-related TypeScript types
 * Mapped from backend DTOs
 */

export enum PriceListType {
  B2C = "B2C",
  B2B = "B2B",
  WHOLESALE = "WHOLESALE",
  RETAIL = "RETAIL",
  CUSTOM = "CUSTOM",
}

export enum PriceListOverrideType {
  FIXED = "FIXED",
  PERCENTAGE = "PERCENTAGE",
}

export interface PriceListItem {
  id: string;
  priceListId: string;
  productVariantId: string | null;
  productId: string | null;
  categoryId: string | null;
  overrideType: PriceListOverrideType;
  overrideValue: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceList {
  id: string;
  name: string;
  description: string | null;
  type: PriceListType;
  priority: number;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  items: PriceListItem[];
  customerGroupIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedPriceListsResponse {
  data: PriceList[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PriceListQueryParams {
  page?: number;
  limit?: number;
  type?: PriceListType;
  isActive?: boolean;
  search?: string;
}

export interface CreatePriceListInput {
  name: string;
  description?: string;
  type?: PriceListType;
  priority?: number;
  isActive?: boolean;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
}

export type UpdatePriceListInput = Partial<CreatePriceListInput>;

export interface CreatePriceListItemInput {
  priceListId: string;
  productVariantId?: string;
  productId?: string;
  categoryId?: string;
  overrideType: PriceListOverrideType;
  overrideValue: number;
}

export interface PricingDriftReportQuery {
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  severity?: string;
  page?: number;
  limit?: number;
}

export interface PricingDriftReportEntry {
  id: string;
  timestamp: Date;
  event: string;
  severity: string;
  variantId?: string;
  orderId?: string;
  checkoutId?: string;
  priceListId?: string;
  customerGroupId?: string;
  basePrice?: number;
  effectivePrice?: number;
  snapshotPrice?: number;
  paymentAmount?: number;
  driftDetails?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PaginatedPricingDriftReportResponse {
  data: PricingDriftReportEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
