import { DiscountType } from "../dto/create-discount.dto";
import { DiscountResponseDto } from "../dto/discount-response.dto";

/**
 * Input to the discount engine
 * All data must be pre-fetched - engine never touches DB/Redis
 */
export interface DiscountEngineInput {
  cart: {
    items: Array<{
      id: string;
      productVariantId: string;
      productId: string;
      categoryId: string | null;
      collectionIds: string[];
      tagIds: string[];
      price: number;
      quantity: number;
    }>;
  };
  customer: {
    id: string;
    customerGroupIds?: string[]; // parsed from discount.customerGroupIds
  } | null;
  discounts: DiscountResponseDto[]; // pre-filtered for validity
  now: Date;
  shippingCost?: number; // Shipping cost for TOTAL discount calculation
}

/**
 * Line item with applied discounts
 */
export interface DiscountedLineItem {
  id: string;
  productVariantId: string;
  productId: string;
  originalPrice: number;
  quantity: number;
  lineTotal: number; // after all discounts
  discounts: Array<{
    discountId: string;
    discountCode: string;
    discountAmount: number;
    discountType: DiscountType;
  }>;
}

/**
 * Cart-level discount applied
 */
export interface AppliedCartDiscount {
  discountId: string;
  discountCode: string;
  discountAmount: number;
  discountType: DiscountType;
}

/**
 * Step-by-step breakdown for debugging/audit
 */
export interface DiscountStep {
  step: string;
  description: string;
  discountsApplied: string[];
  subtotalAfter: number;
}

/**
 * Result from discount engine
 * This becomes the pricing snapshot used for payment intent and order creation
 */
export interface DiscountEngineResult {
  lineItems: DiscountedLineItem[];
  cartDiscounts: AppliedCartDiscount[];
  subtotal: number; // before discounts
  subtotalDiscounts: AppliedCartDiscount[]; // Discounts applied to subtotal
  totalDiscounts: AppliedCartDiscount[]; // Discounts applied to total (after shipping)
  shippingCost: number; // Shipping cost
  discountTotal: number; // total discount applied
  total: number; // after all discounts (including shipping)
  appliedDiscountIds: string[];
  breakdown: {
    lineItems: DiscountedLineItem[];
    cartDiscounts: AppliedCartDiscount[];
    stepByStep: DiscountStep[];
  };
}

/**
 * Resolved discounts after conflict resolution
 */
export interface ResolvedDiscounts {
  productDiscounts: DiscountResponseDto[];
  cartDiscounts: DiscountResponseDto[];
}

/**
 * Bundle variant discount breakdown in discount snapshot
 */
export interface BundleVariantDiscountBreakdown {
  variantId: string;
  discountAmount: number;
  quantity: number;
}

/**
 * Bundle breakdown in discount snapshot
 */
export interface BundleDiscountBreakdown {
  bundleId: string;
  bundleLineId: string;
  lineDiscountTotal: number;
  variantDiscounts: BundleVariantDiscountBreakdown[];
}

/**
 * Discount snapshot extends engine result with versioning and integrity metadata
 * This is the immutable snapshot stored at payment intent creation
 */
export interface DiscountSnapshot extends DiscountEngineResult {
  /**
   * Engine version used to compute this snapshot
   * Format: "discount-engine-v1"
   */
  engineVersion: string;

  /**
   * ISO timestamp when snapshot was computed
   */
  computedAt: string;

  /**
   * SHA-256 hash of discount rules used in computation
   * Prevents discount rule changes during checkout
   */
  ruleHash: string;

  /**
   * Ruleset version used to compute this snapshot
   * Locks snapshot to specific bundle version for historical accuracy
   */
  rulesetVersion: number;

  /**
   * Bundle breakdowns (if any bundles in cart)
   * Contains discount breakdown for each bundle line item
   */
  bundleBreakdowns?: BundleDiscountBreakdown[];
}
