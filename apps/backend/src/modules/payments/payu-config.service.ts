import * as crypto from "node:crypto";
import { Injectable } from "@nestjs/common";

export interface PayUConfig {
  merchantKey: string;
  merchantSalt: string;
  environment: "sandbox" | "production";
  timeout?: number; // Timeout in milliseconds (default: 10000)
}

@Injectable()
export class PayUConfigService {
  private payuConfig: PayUConfig | null = null;

  /**
   * Initialize PayU configuration with merchant credentials
   * @param config - PayU configuration with merchantKey, merchantSalt, environment, and optional timeout
   * @returns PayU configuration
   */
  initialize(config: PayUConfig): PayUConfig {
    if (!config.merchantKey || !config.merchantSalt) {
      throw new Error(
        "PayU merchantKey and merchantSalt are required for initialization",
      );
    }

    this.payuConfig = config;
    return this.payuConfig;
  }

  /**
   * Get the initialized PayU configuration
   * @returns PayU configuration or null if not initialized
   */
  getConfig(): PayUConfig | null {
    return this.payuConfig;
  }

  /**
   * Check if PayU is initialized
   * @returns true if PayU configuration exists
   */
  isInitialized(): boolean {
    return this.payuConfig !== null;
  }

  /**
   * Generate PayU payment hash
   * PayU uses SHA512 hash of: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt
   * @param params - Payment parameters
   * @returns SHA512 hash string
   */
  generateHash(params: {
    txnid: string;
    amount: number;
    productinfo: string;
    firstname: string;
    email: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
    udf6?: string;
    udf7?: string;
    udf8?: string;
    udf9?: string;
    udf10?: string;
  }): string {
    if (!this.payuConfig) {
      throw new Error("PayU is not initialized");
    }

    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1 = "",
      udf2 = "",
      udf3 = "",
      udf4 = "",
      udf5 = "",
      udf6 = "",
      udf7 = "",
      udf8 = "",
      udf9 = "",
      udf10 = "",
    } = params;

    // Build hash string: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt
    const hashString = [
      this.payuConfig.merchantKey,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      udf6,
      udf7,
      udf8,
      udf9,
      udf10,
      this.payuConfig.merchantSalt,
    ].join("|");

    // Generate SHA512 hash
    return crypto.createHash("sha512").update(hashString).digest("hex");
  }

  /**
   * Verify PayU payment response hash
   * PayU response hash: SHA512(key|salt|status|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|email|firstname|productinfo|amount|txnid)
   * @param params - Response parameters
   * @param receivedHash - Hash received from PayU
   * @returns true if hash is valid
   */
  verifyHash(
    params: {
      status: string;
      email: string;
      firstname: string;
      productinfo: string;
      amount: number;
      txnid: string;
      udf1?: string;
      udf2?: string;
      udf3?: string;
      udf4?: string;
      udf5?: string;
      udf6?: string;
      udf7?: string;
      udf8?: string;
      udf9?: string;
      udf10?: string;
    },
    receivedHash: string,
  ): boolean {
    if (!this.payuConfig) {
      throw new Error("PayU is not initialized");
    }

    const {
      status,
      email,
      firstname,
      productinfo,
      amount,
      txnid,
      udf1 = "",
      udf2 = "",
      udf3 = "",
      udf4 = "",
      udf5 = "",
      udf6 = "",
      udf7 = "",
      udf8 = "",
      udf9 = "",
      udf10 = "",
    } = params;

    // Build hash string: key|salt|status|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|email|firstname|productinfo|amount|txnid
    const hashString = [
      this.payuConfig.merchantKey,
      this.payuConfig.merchantSalt,
      status,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      udf6,
      udf7,
      udf8,
      udf9,
      udf10,
      email,
      firstname,
      productinfo,
      amount,
      txnid,
    ].join("|");

    // Generate SHA512 hash
    const generatedHash = crypto
      .createHash("sha512")
      .update(hashString)
      .digest("hex");

    return generatedHash === receivedHash;
  }

  /**
   * Verify PayU webhook hash
   * PayU webhook hash format: SHA512(status|salt|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10)
   * @param params - Webhook parameters
   * @param receivedHash - Hash received from PayU
   * @returns true if hash is valid
   */
  verifyWebhookHash(
    params: {
      status: string;
      txnid: string;
      amount: number;
      productinfo: string;
      firstname: string;
      email: string;
      udf1?: string;
      udf2?: string;
      udf3?: string;
      udf4?: string;
      udf5?: string;
    },
    receivedHash: string,
  ): boolean {
    if (!this.payuConfig) {
      throw new Error("PayU is not initialized");
    }

    const {
      status,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1 = "",
      udf2 = "",
      udf3 = "",
      udf4 = "",
      udf5 = "",
    } = params;

    // Build hash string: status|salt|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5
    const hashString = [
      status,
      this.payuConfig.merchantSalt,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
    ].join("|");

    // Generate SHA512 hash
    const generatedHash = crypto
      .createHash("sha512")
      .update(hashString)
      .digest("hex");

    return generatedHash === receivedHash;
  }

  /**
   * Get PayU API base URL based on environment
   * @returns PayU API base URL
   */
  getApiBaseUrl(): string {
    if (!this.payuConfig) {
      throw new Error("PayU is not initialized");
    }

    return this.payuConfig.environment === "production"
      ? "https://secure.payu.in"
      : "https://test.payu.in";
  }

  /**
   * Reset the PayU configuration (useful for testing)
   */
  reset(): void {
    this.payuConfig = null;
  }
}
