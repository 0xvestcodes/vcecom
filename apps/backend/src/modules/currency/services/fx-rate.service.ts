import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { CurrencyLayerProvider } from "../providers/currencylayer.provider";
import { ExchangeRateApiProvider } from "../providers/exchange-rate-api.provider";
import { FixerIoProvider } from "../providers/fixer-io.provider";
import { IFxProvider } from "../providers/fx-provider.interface";
import { YahooFinanceProvider } from "../providers/yahoo-finance.provider";
import { FxCacheService } from "./fx-cache.service";

/**
 * FX Rate Service
 * Handles exchange rate fetching with provider abstraction and caching
 */
@Injectable()
export class FxRateService {
  private provider: IFxProvider | null = null;

  constructor(
    private readonly cacheService: FxCacheService,
    private readonly exchangeRateApiProvider: ExchangeRateApiProvider,
    private readonly fixerIoProvider: FixerIoProvider,
    private readonly currencyLayerProvider: CurrencyLayerProvider,
    private readonly yahooFinanceProvider: YahooFinanceProvider,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    this.initializeProvider();
  }

  /**
   * Initialize FX provider based on configuration
   */
  private initializeProvider(): void {
    const providerName =
      process.env.FX_PROVIDER?.toLowerCase() || "exchange-rate-api";

    switch (providerName) {
      case "exchange-rate-api":
        if (this.exchangeRateApiProvider.isAvailable()) {
          this.provider = this.exchangeRateApiProvider;
        }
        break;
      case "fixer-io":
        if (this.fixerIoProvider.isAvailable()) {
          this.provider = this.fixerIoProvider;
        }
        break;
      case "currencylayer":
        if (this.currencyLayerProvider.isAvailable()) {
          this.provider = this.currencyLayerProvider;
        }
        break;
      default:
        this.logger.warn(
          { providerName },
          "Unknown FX provider, defaulting to exchange-rate-api",
        );
        if (this.exchangeRateApiProvider.isAvailable()) {
          this.provider = this.exchangeRateApiProvider;
        }
    }

    // If no provider was set, use Yahoo Finance as fallback (always available)
    if (!this.provider) {
      this.provider = this.yahooFinanceProvider;
      this.logger.info(
        { provider: this.provider.getName() },
        "No FX provider configured, using Yahoo Finance as fallback",
      );
    } else {
      this.logger.info(
        { provider: this.provider.getName() },
        "FX provider initialized",
      );
    }
  }

  /**
   * Get exchange rate for a currency pair
   * Uses cache first, falls back to provider, then to cached value if provider fails
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param forceRefresh - Force refresh from provider (skip cache)
   * @returns Exchange rate
   */
  async getRate(
    fromCurrency: string,
    toCurrency: string,
    forceRefresh = false,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    // Normalize currency codes to uppercase
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    // Try cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await this.cacheService.getRate(from, to);
      if (cached !== null) {
        return cached;
      }
    }

    // If no provider available, try to return cached value even if expired
    if (!this.provider) {
      const cached = await this.cacheService.getRate(from, to);
      if (cached !== null) {
        this.logger.warn(
          { from, to, cached },
          "FX provider not available, using stale cached rate",
        );
        return cached;
      }
      throw new Error(
        "FX provider is not configured and no cached rate is available",
      );
    }

    // Fetch from provider
    try {
      const rate = await this.provider.getRate(from, to);

      // Cache the rate
      await this.cacheService.setRate(from, to, rate);

      this.logger.debug(
        createLogContext(this.contextService, "getRate", {
          from,
          to,
          rate,
          provider: this.provider.getName(),
        }),
        "FX rate fetched from provider",
      );

      return rate;
    } catch (error) {
      // If provider fails, try to use cached value as fallback
      const cached = await this.cacheService.getRate(from, to);
      if (cached !== null) {
        this.logger.warn(
          createErrorContext(this.contextService, "getRate", error, {
            from,
            to,
            cached,
          }),
          "FX provider failed, using cached rate",
        );
        return cached;
      }

      // No cached value available, throw error
      throw new Error(
        `Failed to fetch exchange rate from ${this.provider.getName()}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get exchange rates for multiple currency pairs
   * @param baseCurrency - Base currency code
   * @param targetCurrencies - Array of target currency codes
   * @param forceRefresh - Force refresh from provider (skip cache)
   * @returns Object mapping target currencies to exchange rates
   */
  async getRates(
    baseCurrency: string,
    targetCurrencies: string[],
    forceRefresh = false,
  ): Promise<Record<string, number>> {
    if (targetCurrencies.length === 0) {
      return {};
    }

    // Normalize currency codes
    const base = baseCurrency.toUpperCase();
    const targets = targetCurrencies.map((c) => c.toUpperCase());

    const rates: Record<string, number> = {};
    rates[base] = 1; // Base currency rate is always 1

    // Get cached rates first (unless force refresh)
    if (!forceRefresh) {
      const cachedRates = await this.cacheService.getRates(base, targets);
      Object.assign(rates, cachedRates);
    }

    // Find missing rates
    const missingTargets = targets.filter(
      (target) => target !== base && rates[target] === undefined,
    );

    if (missingTargets.length === 0) {
      return rates;
    }

    // If no provider available, return what we have from cache
    if (!this.provider) {
      if (Object.keys(rates).length === 1) {
        // Only base currency, no cached rates
        throw new Error(
          "FX provider is not configured and no cached rates are available",
        );
      }
      this.logger.warn(
        { base, missingTargets },
        "FX provider not available, using cached rates only",
      );
      return rates;
    }

    // Fetch missing rates from provider
    try {
      const providerRates = await this.provider.getRates(base, missingTargets);

      // Cache the rates
      await this.cacheService.setRates(base, providerRates);

      // Merge with existing rates
      Object.assign(rates, providerRates);

      this.logger.debug(
        createLogContext(this.contextService, "getRates", {
          base,
          targets: missingTargets,
          fetched: Object.keys(providerRates).length,
          provider: this.provider.getName(),
        }),
        "FX rates fetched from provider",
      );
    } catch (error) {
      // If provider fails, try to get individual rates from cache
      for (const target of missingTargets) {
        const cached = await this.cacheService.getRate(base, target);
        if (cached !== null) {
          rates[target] = cached;
        }
      }

      // If we still have missing rates, log warning
      const stillMissing = missingTargets.filter(
        (target) => rates[target] === undefined,
      );
      if (stillMissing.length > 0) {
        this.logger.warn(
          createErrorContext(this.contextService, "getRates", error, {
            base,
            stillMissing,
          }),
          "FX provider failed, some rates may be missing",
        );
      }
    }

    return rates;
  }

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return this.provider?.getName() || "none";
  }

  /**
   * Check if provider is available
   */
  isProviderAvailable(): boolean {
    return this.provider?.isAvailable() ?? false;
  }
}
