/**
 * Currency types for admin panel
 */

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
  isDefault: boolean;
  decimalPlaces: number;
  exchangeRate?: number | null;
  lastUpdated?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCurrencyDto {
  code: string;
  name: string;
  symbol: string;
  isActive?: boolean;
  isDefault?: boolean;
  decimalPlaces?: number;
}

export interface UpdateCurrencyDto {
  name?: string;
  symbol?: string;
  isActive?: boolean;
  isDefault?: boolean;
  decimalPlaces?: number;
}
