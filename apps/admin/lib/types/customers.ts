/**
 * Customer-related TypeScript types
 * Mapped from backend DTOs
 */

export interface Customer {
  id: string;
  userId: string;
  email: string;
  phone: string;
  name: string;
  gstin: string | null;
  totalOrders?: number;
  totalSpent?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedCustomersResponse {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}
