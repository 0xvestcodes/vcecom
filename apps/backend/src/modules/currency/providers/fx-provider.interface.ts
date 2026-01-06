/**
 * FX Provider Interface
 * Abstract interface for exchange rate providers
 */
export interface IFxProvider {
  /**
   * Get exchange rate for a single currency pair
   * @param from - Source currency code (ISO 4217)
   * @param to - Target currency code (ISO 4217)
   * @returns Exchange rate (1 from = rate to)
   */
  getRate(from: string, to: string): Promise<number>;

  /**
   * Get exchange rates for multiple currency pairs from a base currency
   * @param base - Base currency code (ISO 4217)
   * @param targets - Array of target currency codes
   * @returns Object mapping target currency codes to exchange rates
   */
  getRates(base: string, targets: string[]): Promise<Record<string, number>>;

  /**
   * Get provider name
   */
  getName(): string;

  /**
   * Check if provider is available/configured
   */
  isAvailable(): boolean;
}
