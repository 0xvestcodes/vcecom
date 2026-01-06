import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class CurrencyResponseDto {
  @ApiProperty({ description: "Currency ID" })
  id!: string;

  @ApiProperty({ description: "ISO 4217 currency code (e.g., USD, INR)" })
  code!: string;

  @ApiProperty({ description: "Currency name (e.g., US Dollar)" })
  name!: string;

  @ApiProperty({ description: "Currency symbol (e.g., $, ₹)" })
  symbol!: string;

  @ApiProperty({ description: "Whether currency is active" })
  isActive!: boolean;

  @ApiProperty({ description: "Whether currency is the default" })
  isDefault!: boolean;

  @ApiProperty({ description: "Number of decimal places for display" })
  decimalPlaces!: number;

  @ApiPropertyOptional({
    description: "Cached exchange rate relative to store base currency",
  })
  exchangeRate?: number | null;

  @ApiPropertyOptional({ description: "When exchange rate was last updated" })
  lastUpdated?: Date | null;

  @ApiProperty({ description: "Created timestamp" })
  createdAt!: Date;

  @ApiProperty({ description: "Updated timestamp" })
  updatedAt!: Date;
}

export class CreateCurrencyDto {
  @ApiProperty({ description: "ISO 4217 currency code (e.g., USD, INR)" })
  @IsString()
  code!: string;

  @ApiProperty({ description: "Currency name (e.g., US Dollar)" })
  @IsString()
  name!: string;

  @ApiProperty({ description: "Currency symbol (e.g., $, ₹)" })
  @IsString()
  symbol!: string;

  @ApiPropertyOptional({
    description: "Whether currency is active",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Whether currency is the default",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: "Number of decimal places for display",
    default: 2,
  })
  @IsOptional()
  @IsInt()
  decimalPlaces?: number;
}

export class UpdateCurrencyDto {
  @ApiPropertyOptional({ description: "Currency name (e.g., US Dollar)" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "Currency symbol (e.g., $, ₹)" })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({ description: "Whether currency is active" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "Whether currency is the default" })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: "Number of decimal places for display" })
  @IsOptional()
  @IsInt()
  decimalPlaces?: number;
}

export class ExchangeRateResponseDto {
  @ApiProperty({ description: "Exchange rate ID" })
  id!: string;

  @ApiProperty({ description: "Source currency code" })
  fromCurrency!: string;

  @ApiProperty({ description: "Target currency code" })
  toCurrency!: string;

  @ApiProperty({
    description: "Exchange rate (1 fromCurrency = rate toCurrency)",
  })
  rate!: number;

  @ApiProperty({ description: "Provider name" })
  source!: string;

  @ApiProperty({ description: "Last updated timestamp" })
  lastUpdated!: Date;
}
