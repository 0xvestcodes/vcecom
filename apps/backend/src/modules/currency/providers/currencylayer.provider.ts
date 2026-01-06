import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { IFxProvider } from "./fx-provider.interface";

/**
 * CurrencyLayer Provider
 * https://currencylayer.com/
 */
@Injectable()
export class CurrencyLayerProvider implements IFxProvider {
  private readonly apiKey: string | undefined;
  private readonly baseUrl = "http://api.currencylayer.com";

  constructor(private readonly logger: PinoLogger) {
    this.apiKey =
      process.env.FX_PROVIDER_API_KEY || process.env.CURRENCYLAYER_API_KEY;
  }

  getName(): string {
    return "currencylayer";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async getRate(from: string, to: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error("CurrencyLayer provider is not configured");
    }

    if (from === to) {
      return 1;
    }

    try {
      // CurrencyLayer uses USD as base by default
      // For non-USD base, we need to calculate: rate = quotes[USD_TO] / quotes[USD_FROM]
      const url = `${this.baseUrl}/live?access_key=${this.apiKey}&currencies=${from},${to}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `CurrencyLayer error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          `CurrencyLayer error: ${data.error?.info || "Unknown error"}`,
        );
      }

      // CurrencyLayer returns quotes as "USDXXX" format
      const fromKey = `USD${from}`;
      const toKey = `USD${to}`;

      if (from === "USD") {
        return data.quotes[toKey] || 1;
      }

      if (to === "USD") {
        return 1 / (data.quotes[fromKey] || 1);
      }

      // Both non-USD: rate = (USD/to) / (USD/from)
      const usdToFrom = data.quotes[fromKey];
      const usdToTo = data.quotes[toKey];

      if (!usdToFrom || !usdToTo) {
        throw new Error(`CurrencyLayer: Missing quotes for ${from} or ${to}`);
      }

      return usdToTo / usdToFrom;
    } catch (error) {
      this.logger.error(
        { from, to, error },
        "Failed to fetch exchange rate from CurrencyLayer",
      );
      throw error;
    }
  }

  async getRates(
    base: string,
    targets: string[],
  ): Promise<Record<string, number>> {
    if (!this.isAvailable()) {
      throw new Error("CurrencyLayer provider is not configured");
    }

    if (targets.length === 0) {
      return {};
    }

    try {
      const allCurrencies = [...new Set([...targets, base])];
      const currenciesParam = allCurrencies.join(",");
      const url = `${this.baseUrl}/live?access_key=${this.apiKey}&currencies=${currenciesParam}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `CurrencyLayer error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          `CurrencyLayer error: ${data.error?.info || "Unknown error"}`,
        );
      }

      const rates: Record<string, number> = {};
      rates[base] = 1; // Base currency rate is always 1

      // CurrencyLayer returns quotes as "USDXXX" format
      const baseKey = `USD${base}`;
      const baseRate = base === "USD" ? 1 : data.quotes[baseKey] || 1;

      for (const target of targets) {
        if (target === base) {
          rates[target] = 1;
        } else {
          const targetKey = `USD${target}`;
          const targetRate = target === "USD" ? 1 : data.quotes[targetKey];

          if (!targetRate) {
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
          } else {
            // Convert: rate = (USD/target) / (USD/base)
            rates[target] = targetRate / baseRate;
          }
        }
      }

      return rates;
    } catch (error) {
      this.logger.error(
        { base, targets, error },
        "Failed to fetch exchange rates from CurrencyLayer",
      );
      throw error;
    }
  }
}
