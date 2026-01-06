export enum BlacklistType {
  EMAIL = "email",
  PHONE = "phone",
  ADDRESS = "address",
}

export interface AddToBlacklistDto {
  type: BlacklistType;
  value: string;
  reason?: string;
}

export interface FraudBlacklistDto {
  id: string;
  type: BlacklistType;
  value: string;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedBlacklistResponseDto {
  data: FraudBlacklistDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FraudFlaggedOrderDto {
  id: string;
  orderId: string;
  riskScore: number;
  riskFactors: Record<string, boolean>;
  flagged: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedFlaggedOrdersResponseDto {
  data: FraudFlaggedOrderDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReviewOrderDto {
  notes?: string;
}

export interface FraudRiskScoreDto {
  id: string;
  orderId: string;
  riskScore: number;
  riskFactors: Record<string, boolean>;
  flagged: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}
