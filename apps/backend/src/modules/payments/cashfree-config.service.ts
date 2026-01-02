import { Injectable } from "@nestjs/common";

export interface CashfreeConfig {
  appId: string;
  secretKey: string;
  environment: "sandbox" | "production";
  timeout?: number; // Timeout in milliseconds (default: 10000)
}

@Injectable()
export class CashfreeConfigService {
  private cashfreeConfig: CashfreeConfig | null = null;

  /**
   * Initialize Cashfree configuration with API keys
   * @param config - Cashfree configuration with appId, secretKey, environment, and optional timeout
   * @returns Cashfree configuration
   */
  initialize(config: CashfreeConfig): CashfreeConfig {
    if (!config.appId || !config.secretKey) {
      throw new Error(
        "Cashfree appId and secretKey are required for initialization",
      );
    }

    this.cashfreeConfig = config;
    return this.cashfreeConfig;
  }

  /**
   * Get the initialized Cashfree configuration
   * @returns Cashfree configuration or null if not initialized
   */
  getConfig(): CashfreeConfig | null {
    return this.cashfreeConfig;
  }

  /**
   * Check if Cashfree is initialized
   * @returns true if Cashfree configuration exists
   */
  isInitialized(): boolean {
    return this.cashfreeConfig !== null;
  }

  /**
   * Reset the Cashfree configuration (useful for testing)
   */
  reset(): void {
    this.cashfreeConfig = null;
  }
}
