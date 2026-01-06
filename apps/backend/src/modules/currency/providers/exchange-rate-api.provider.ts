import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { IFxProvider } from "./fx-provider.interface";

/**
 * ExchangeRate-API Provider
 * Free tier: https://www.exchangerate-api.com/
 */
@Injectable()
export class ExchangeRateApiProvider implements IFxProvider {
  private readonly apiKey: string | undefined;
  private readonly baseUrl = "https://v6.exchangerate-api.com/v6";

  constructor(private readonly logger: PinoLogger) {
    this.apiKey =
      process.env.FX_PROVIDER_API_KEY || process.env.EXCHANGE_RATE_API_KEY;
  }

  getName(): string {
    return "exchange-rate-api";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async getRate(from: string, to: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error("ExchangeRate-API provider is not configured");
    }

    if (from === to) {
      return 1;
    }

    try {
      const url = `${this.baseUrl}/${this.apiKey}/pair/${from}/${to}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `ExchangeRate-API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (data.result !== "success") {
        throw new Error(
          `ExchangeRate-API error: ${data["error-type"] || "Unknown error"}`,
        );
      }

      return data.conversion_rate;
    } catch (error) {
      this.logger.error(
        { from, to, error },
        "Failed to fetch exchange rate from ExchangeRate-API",
      );
      throw error;
    }
  }

  async getRates(
    base: string,
    targets: string[],
  ): Promise<Record<string, number>> {
    if (!this.isAvailable()) {
      throw new Error("ExchangeRate-API provider is not configured");
    }

    if (targets.length === 0) {
      return {};
    }

    try {
      // ExchangeRate-API supports fetching multiple rates at once
      const url = `${this.baseUrl}/${this.apiKey}/latest/${base}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `ExchangeRate-API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (data.result !== "success") {
        throw new Error(
          `ExchangeRate-API error: ${data["error-type"] || "Unknown error"}`,
        );
      }

      const rates: Record<string, number> = {};
      rates[base] = 1; // Base currency rate is always 1

      for (const target of targets) {
        if (target === base) {
          rates[target] = 1;
        } else if (data.conversion_rates?.[target]) {
          rates[target] = data.conversion_rates[target];
        } else {
          this.logger.warn(
            { base, target },
            "Exchange rate not found for target currency",
          );
          // Try individual fetch as fallback
          try {
            rates[target] = await this.getRate(base, target);
          } catch (err) {
            this.logger.error(
              { base, target, error: err },
              "Failed to fetch individual exchange rate",
            );
            throw err;
          }
        }
      }

      return rates;
    } catch (error) {
      this.logger.error(
        { base, targets, error },
        "Failed to fetch exchange rates from ExchangeRate-API",
      );
      throw error;
    }
  }
}
