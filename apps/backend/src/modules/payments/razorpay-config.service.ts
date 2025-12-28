import { Injectable } from "@nestjs/common";
import Razorpay from "razorpay";

// Extend Razorpay config to include timeout (supported at runtime but not in TypeScript definitions)
interface RazorpayConfigWithTimeout {
  key_id: string;
  key_secret: string;
  timeout?: number;
}

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  timeout?: number; // Timeout in milliseconds (default: 10000)
}

@Injectable()
export class RazorpayConfigService {
  private razorpayInstance: Razorpay | null = null;

  /**
   * Initialize Razorpay instance with API keys
   * @param config - Razorpay configuration with keyId, keySecret, and optional timeout
   * @returns Razorpay instance
   */
  initialize(config: RazorpayConfig): Razorpay {
    if (!config.keyId || !config.keySecret) {
      throw new Error(
        "Razorpay keyId and keySecret are required for initialization",
      );
    }

    // Configure Razorpay with timeout (default: 10 seconds)
    // This ensures SDK-level timeout handling, which is more reliable than wrapping promises
    // Note: timeout is supported by Razorpay SDK at runtime but TypeScript definitions don't include it
    const timeout = config.timeout ?? 10000;

    const razorpayConfig: RazorpayConfigWithTimeout = {
      key_id: config.keyId,
      key_secret: config.keySecret,
      timeout, // SDK-level timeout for all API requests (supported at runtime)
    };

    // Type assertion needed because Razorpay TypeScript definitions don't include timeout
    // but it's supported at runtime by the SDK (see Razorpay SDK documentation)
    // Using unknown as intermediate type for safer type assertion
    this.razorpayInstance = new Razorpay(
      razorpayConfig as unknown as ConstructorParameters<typeof Razorpay>[0],
    );

    return this.razorpayInstance;
  }

  /**
   * Get the initialized Razorpay instance
   * @returns Razorpay instance or null if not initialized
   */
  getInstance(): Razorpay | null {
    return this.razorpayInstance;
  }

  /**
   * Check if Razorpay is initialized
   * @returns true if Razorpay instance exists
   */
  isInitialized(): boolean {
    return this.razorpayInstance !== null;
  }

  /**
   * Reset the Razorpay instance (useful for testing)
   */
  reset(): void {
    this.razorpayInstance = null;
  }
}
