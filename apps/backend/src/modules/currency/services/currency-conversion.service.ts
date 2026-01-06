import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { CurrencyService } from "../currency.service";
import { FxRateService } from "./fx-rate.service";

/**
 * Currency Conversion Service
 * High-level service for currency conversion with rounding and validation
 */
@Injectable()
export class CurrencyConversionService {
  constructor(
    private readonly fxRateService: FxRateService,
    private readonly currencyService: CurrencyService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Convert amount from one currency to another
   * @param amount - Amount to convert
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param forceRefresh - Force refresh exchange rate from provider
   * @returns Converted amount rounded to target currency's decimal places
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    forceRefresh = false,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    try {
      // Get exchange rate
      const rate = await this.fxRateService.getRate(
        fromCurrency,
        toCurrency,
        forceRefresh,
      );

      // Convert amount
      const converted = amount * rate;

      // Get target currency to determine decimal places
      const targetCurrency = await this.currencyService.findByCode(toCurrency);
      const decimalPlaces = targetCurrency?.decimalPlaces ?? 2;

      // Round to target currency's decimal places
      const rounded = this.roundToDecimalPlaces(converted, decimalPlaces);

      this.logger.debug(
        createLogContext(this.contextService, "convert", {
          amount,
          fromCurrency,
          toCurrency,
          rate,
          converted: rounded,
        }),
        "Currency converted",
      );

      return rounded;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "convert", error, {
          amount,
          fromCurrency,
          toCurrency,
        }),
        "Failed to convert currency",
      );
      throw error;
    }
  }

  /**
   * Convert multiple amounts from one currency to another
   * @param amounts - Array of amounts to convert
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param forceRefresh - Force refresh exchange rate from provider
   * @returns Array of converted amounts
   */
  async convertBatch(
    amounts: number[],
    fromCurrency: string,
    toCurrency: string,
    forceRefresh = false,
  ): Promise<number[]> {
    if (fromCurrency === toCurrency) {
      return amounts;
    }

    try {
      // Get exchange rate once
      const rate = await this.fxRateService.getRate(
        fromCurrency,
        toCurrency,
        forceRefresh,
      );

      // Get target currency to determine decimal places
      const targetCurrency = await this.currencyService.findByCode(toCurrency);
      const decimalPlaces = targetCurrency?.decimalPlaces ?? 2;

      // Convert all amounts
      return amounts.map((amount) => {
        const converted = amount * rate;
        return this.roundToDecimalPlaces(converted, decimalPlaces);
      });
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "convertBatch", error, {
          count: amounts.length,
          fromCurrency,
          toCurrency,
        }),
        "Failed to convert currencies in batch",
      );
      throw error;
    }
  }

  /**
   * Get smallest unit multiplier for a currency
   * e.g., 100 for INR (paise), 100 for USD (cents), 1 for JPY (no subunit)
   * @param currencyCode - Currency code
   * @returns Smallest unit multiplier
   */
  async getSmallestUnitMultiplier(currencyCode: string): Promise<number> {
    const currency = await this.currencyService.findByCode(currencyCode);
    // Most currencies use 100 (cents, paise, etc.)
    // Some like JPY use 1 (no subunit)
    // For now, default to 100, can be extended with currency-specific logic
    return currency?.decimalPlaces === 0 ? 1 : 100;
  }

  /**
   * Round to specific decimal places
   * @param value - Value to round
   * @param decimalPlaces - Number of decimal places
   * @returns Rounded value
   */
  private roundToDecimalPlaces(value: number, decimalPlaces: number): number {
    const multiplier = 10 ** decimalPlaces;
    return Math.round(value * multiplier) / multiplier;
  }
}
