import { DiscountSnapshot } from "../../discounts/engine/discount-engine.types";
import { PricingSnapshot } from "../../pricing/engine/pricing-engine.types";

/**
 * Checkout metadata stored in Redis
 * Contains order creation data that needs to be preserved until payment confirmation
 */
export interface CheckoutMetadata {
  email?: string;
  phone?: string;
  /**
   * Customer ID who initiated the checkout (required)
   * Used for both authenticated and guest customers
   */
  customerId: string;

  /**
   * User ID who initiated the checkout (optional, null for guests)
   * Kept for backward compatibility
   */
  userId: string | null;

  /**
   * Shipping address ID
   */
  shippingAddressId: string;

  /**
   * Billing address ID
   */
  billingAddressId: string;

  /**
   * Shipping cost in INR
   */
  shippingCost: number;

  /**
   * Discount snapshot from discount engine
   * Immutable snapshot frozen at payment intent creation
   * Includes engine version, timestamp, and rule hash for integrity
   */
  discountSnapshot: DiscountSnapshot | null;

  /**
   * Pricing snapshot from pricing engine
   * Immutable snapshot frozen at payment intent creation
   * Includes engine version, timestamp, and rule hash for integrity
   */
  pricingSnapshot: PricingSnapshot | null;

  /**
   * Selected payment method
   */
  paymentMethod?: string;

  /**
   * Payment fee in paise
   */
  paymentFee?: number;

  /**
   * Payment fee breakdown details
   */
  paymentFeeBreakdown?: {
    method: string;
    chargeType: string;
    flatAmount?: number;
    percentage?: number;
    calculatedFee: number;
    mixMin?: number;
    mixCap?: number;
  };

  /**
   * Timestamp when metadata was created
   * ISO 8601 format string
   */
  createdAt: string;
}
