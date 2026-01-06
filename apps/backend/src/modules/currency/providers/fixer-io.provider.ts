import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { IFxProvider } from "./fx-provider.interface";

/**
 * Fixer.io Provider
 * https://fixer.io/
 */
@Injectable()
export class FixerIoProvider implements IFxProvider {
  private readonly apiKey: string | undefined;
  private readonly baseUrl = "http://data.fixer.io/api";

  constructor(private readonly logger: PinoLogger) {
    this.apiKey =
      process.env.FX_PROVIDER_API_KEY || process.env.FIXER_IO_API_KEY;
  }

  getName(): string {
    return "fixer-io";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async getRate(from: string, to: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error("Fixer.io provider is not configured");
    }

    if (from === to) {
      return 1;
    }

    try {
      // Fixer.io uses EUR as base by default, need to convert
      const url = `${this.baseUrl}/latest?access_key=${this.apiKey}&base=${from}&symbols=${to}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Fixer.io error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          `Fixer.io error: ${data.error?.info || "Unknown error"}`,
        );
      }

      return data.rates[to];
    } catch (error) {
      this.logger.error(
        { from, to, error },
        "Failed to fetch exchange rate from Fixer.io",
      );
      throw error;
    }
  }

  async getRates(
    base: string,
    targets: string[],
  ): Promise<Record<string, number>> {
    if (!this.isAvailable()) {
      throw new Error("Fixer.io provider is not configured");
    }

    if (targets.length === 0) {
      return {};
    }

    try {
      const symbols = [...new Set([...targets, base])].join(",");
      const url = `${this.baseUrl}/latest?access_key=${this.apiKey}&base=${base}&symbols=${symbols}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Fixer.io error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          `Fixer.io error: ${data.error?.info || "Unknown error"}`,
        );
      }

      const rates: Record<string, number> = {};
      rates[base] = 1; // Base currency rate is always 1

      for (const target of targets) {
        if (target === base) {
          rates[target] = 1;
        } else if (data.rates?.[target]) {
          rates[target] = data.rates[target];
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
        "Failed to fetch exchange rates from Fixer.io",
      );
      throw error;
    }
  }
}
