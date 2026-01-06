import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import YahooFinance from "yahoo-finance2";
import { IFxProvider } from "./fx-provider.interface";

/**
 * Yahoo Finance Provider
 * Free provider using yahoo-finance2 package
 * https://www.npmjs.com/package/yahoo-finance2
 */
@Injectable()
export class YahooFinanceProvider implements IFxProvider {
  private readonly yahooFinance: InstanceType<typeof YahooFinance>;

  constructor(private readonly logger: PinoLogger) {
    this.yahooFinance = new YahooFinance();
  }

  getName(): string {
    return "yahoo-finance";
  }

  /**
   * Yahoo Finance is always available (no API key required)
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Get exchange rate for a currency pair
   * @param from - Source currency code (ISO 4217, e.g., "USD")
   * @param to - Target currency code (ISO 4217, e.g., "EUR")
   * @returns Exchange rate (1 from = rate to)
   */
  async getRate(from: string, to: string): Promise<number> {
    if (from === to) {
      return 1;
    }

    try {
      // Yahoo Finance uses format: USDEUR=X for USD to EUR
      const symbol = `${from.toUpperCase()}${to.toUpperCase()}=X`;

      const quote = await this.yahooFinance.quote(symbol);

      if (!quote) {
        throw new Error(
          `Yahoo Finance: No exchange rate data available for ${from}/${to}`,
        );
      }

      // Extract the exchange rate from the quote
      const rate = (quote as { regularMarketPrice?: number })
        .regularMarketPrice;

      if (rate === undefined || rate === null) {
        throw new Error(
          `Yahoo Finance: Exchange rate not found in quote data for ${from}/${to}`,
        );
      }

      this.logger.debug(
        { from, to, symbol, rate },
        "Fetched exchange rate from Yahoo Finance",
      );

      return rate;
    } catch (error) {
      this.logger.error(
        { from, to, error },
        "Failed to fetch exchange rate from Yahoo Finance",
      );
      throw new Error(
        `Yahoo Finance error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get exchange rates for multiple currency pairs from a base currency
   * @param base - Base currency code (ISO 4217)
   * @param targets - Array of target currency codes
   * @returns Object mapping target currency codes to exchange rates
   */
  async getRates(
    base: string,
    targets: string[],
  ): Promise<Record<string, number>> {
    if (targets.length === 0) {
      return {};
    }

    const rates: Record<string, number> = {};
    rates[base.toUpperCase()] = 1; // Base currency rate is always 1

    // Fetch rates for each target currency
    const fetchPromises = targets
      .filter((target) => target.toUpperCase() !== base.toUpperCase())
      .map(async (target) => {
        try {
          const rate = await this.getRate(base, target);
          rates[target.toUpperCase()] = rate;
        } catch (error) {
          this.logger.warn(
            { base, target, error },
            "Failed to fetch individual exchange rate from Yahoo Finance",
          );
          // Don't throw - continue fetching other rates
        }
      });

    await Promise.all(fetchPromises);

    // If we couldn't fetch any rates, throw an error
    if (Object.keys(rates).length === 1) {
      throw new Error(
        `Failed to fetch any exchange rates from Yahoo Finance for base ${base}`,
      );
    }

    return rates;
  }
}
