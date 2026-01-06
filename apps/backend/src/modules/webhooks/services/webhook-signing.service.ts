import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";

/**
 * Webhook Signing Service
 * Handles HMAC-SHA256 signing for outgoing webhooks and validation for incoming webhooks
 */
@Injectable()
export class WebhookSigningService {
  /**
   * Generate HMAC-SHA256 signature for webhook payload
   * @param payload - The webhook payload (stringified JSON)
   * @param secret - The webhook secret
   * @returns The signature in format: sha256=<hex_signature>
   */
  sign(payload: string, secret: string): string {
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const signature = hmac.digest("hex");
    return `sha256=${signature}`;
  }

  /**
   * Verify webhook signature
   * @param payload - The webhook payload (stringified JSON)
   * @param signature - The signature header value (format: sha256=<hex_signature>)
   * @param secret - The webhook secret
   * @returns true if signature is valid, false otherwise
   */
  verify(payload: string, signature: string, secret: string): boolean {
    if (!signature || !signature.startsWith("sha256=")) {
      return false;
    }

    const expectedSignature = this.sign(payload, secret);
    const providedSignature = signature;

    // Use timing-safe comparison to prevent timing attacks
    if (expectedSignature.length !== providedSignature.length) {
      return false;
    }

    try {
      return timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedSignature),
      );
    } catch {
      return false;
    }
  }

  /**
   * Extract signature from header value
   * Supports multiple formats:
   * - "sha256=<signature>"
   * - "sha256=<signature>, sha256=<signature>" (multiple signatures)
   * @param signatureHeader - The signature header value
   * @returns The first sha256 signature found, or null
   */
  extractSignature(signatureHeader: string): string | null {
    if (!signatureHeader) {
      return null;
    }

    // Handle multiple signatures (comma-separated)
    const signatures = signatureHeader.split(",").map((s) => s.trim());
    const sha256Signature = signatures.find((s) => s.startsWith("sha256="));

    return sha256Signature || null;
  }
}
