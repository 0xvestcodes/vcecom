import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  and,
  eq,
  inArray,
  PaymentMethod,
  paymentMethodCharges,
  products,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  PaymentFeeBreakdownDto,
  PaymentMethodWithFeeDto,
} from "../dto/payment-charge.dto";
import { PaymentFeeAuditService } from "./payment-fee-audit.service";

export interface CartItem {
  productVariantId: string;
  quantity: number;
  price: number;
  metadata?: unknown;
}

export interface ShippingAddress {
  country?: string;
  state?: string;
  pincode?: string;
}

export interface CodEligibilityContext {
  shippingAddress?: ShippingAddress;
  customerGroupIds?: string[];
  checkoutId?: string; // Checkout session ID for audit logging
}

@Injectable()
export class PaymentChargeService {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(DB_TOKEN) private readonly db: Database,
    @Optional() private readonly auditService?: PaymentFeeAuditService,
  ) {}

  /**
   * Calculate payment fee for a given method and cart total
   */
  async calculateFee(
    method: string,
    cartTotal: number, // in paise
    currency: string = "INR",
  ): Promise<{ fee: number; breakdown: PaymentFeeBreakdownDto }> {
    // Fetch active charge configuration for the method and currency
    const [chargeConfig] = await this.db
      .select()
      .from(paymentMethodCharges)
      .where(
        and(
          eq(paymentMethodCharges.method, method as PaymentMethod),
          eq(paymentMethodCharges.currency, currency),
          eq(paymentMethodCharges.active, true),
        ),
      )
      .limit(1);

    if (!chargeConfig) {
      // Fallback to INR if no config found for currency
      if (currency !== "INR") {
        return this.calculateFee(method, cartTotal, "INR");
      }
      this.logger.warn(
        { method, currency },
        "No active charge configuration found, returning zero fee",
      );
      return {
        fee: 0,
        breakdown: {
          method,
          chargeType: "FLAT",
          calculatedFee: 0,
        },
      };
    }

    let fee = 0;
    const breakdown: PaymentFeeBreakdownDto = {
      method,
      chargeType: chargeConfig.chargeType,
      calculatedFee: 0,
    };

    switch (chargeConfig.chargeType) {
      case "FLAT":
        fee = chargeConfig.flatAmount;
        breakdown.flatAmount = chargeConfig.flatAmount;
        break;

      case "PERCENTAGE":
        fee = Math.round((chargeConfig.percentage / 100) * cartTotal);
        breakdown.percentage = chargeConfig.percentage;
        break;

      case "MIXED": {
        // Calculate percentage-based fee
        let baseFee = Math.round((chargeConfig.percentage / 100) * cartTotal);
        breakdown.percentage = chargeConfig.percentage;

        // Apply minimum if specified
        if (chargeConfig.mixMin !== null && chargeConfig.mixMin !== undefined) {
          baseFee = Math.max(baseFee, chargeConfig.mixMin);
          breakdown.mixMin = chargeConfig.mixMin;
        }

        // Apply cap if specified
        if (chargeConfig.mixCap !== null && chargeConfig.mixCap !== undefined) {
          baseFee = Math.min(baseFee, chargeConfig.mixCap);
          breakdown.mixCap = chargeConfig.mixCap;
        }

        // Add flat amount
        fee = baseFee + chargeConfig.flatAmount;
        breakdown.flatAmount = chargeConfig.flatAmount;
        break;
      }
    }

    // Ensure fee is non-negative
    fee = Math.max(0, fee);

    breakdown.calculatedFee = fee;

    return { fee, breakdown };
  }

  /**
   * Get all available payment methods with calculated fees
   */
  async getAvailableMethods(
    cartTotal: number, // in paise
    currency: string = "INR",
    cartItems: CartItem[] = [],
    context?: CodEligibilityContext,
  ): Promise<PaymentMethodWithFeeDto[]> {
    // Fetch all active charge configurations for the currency
    const chargeConfigs = await this.db
      .select()
      .from(paymentMethodCharges)
      .where(
        and(
          eq(paymentMethodCharges.currency, currency),
          eq(paymentMethodCharges.active, true),
          eq(paymentMethodCharges.storeLevelDisabled, false), // Exclude store-level disabled methods
        ),
      );

    // If no configs for currency, fallback to INR
    if (chargeConfigs.length === 0 && currency !== "INR") {
      return this.getAvailableMethods(cartTotal, "INR", cartItems, context);
    }

    const methods: PaymentMethodWithFeeDto[] = [];

    for (const config of chargeConfigs) {
      // Check order value restrictions (min/max)
      if (config.minOrderValue !== null && cartTotal < config.minOrderValue) {
        continue; // Skip method if below minimum
      }
      if (config.maxOrderValue !== null && cartTotal > config.maxOrderValue) {
        continue; // Skip method if above maximum
      }

      // Check region restrictions
      if (config.restrictedRegions && context?.shippingAddress) {
        const regions = config.restrictedRegions as {
          countries?: string[];
          states?: string[];
        };
        if (
          regions.countries?.includes(context.shippingAddress.country || "") ||
          regions.states?.includes(context.shippingAddress.state || "")
        ) {
          continue; // Skip if region is restricted
        }
      }

      // Check cart content restrictions
      if (config.restrictedCartContent) {
        const restrictions = config.restrictedCartContent as {
          hazmat?: boolean;
          digital?: boolean;
          subscription?: boolean;
        };
        // Digital check will be done in COD eligibility
        if (restrictions.hazmat || restrictions.subscription) {
          // TODO: Implement hazmat/subscription detection
          // For now, skip if restriction is set
          if (restrictions.hazmat || restrictions.subscription) {
            continue;
          }
        }
      }

      const { fee, breakdown } = await this.calculateFee(
        config.method,
        cartTotal,
        currency,
      );

      // Check method-specific eligibility (COD has additional checks)
      let available = true;
      let unavailableReason: string | undefined;

      if (config.method === "COD") {
        const eligibility = await this.validateCodEligibility(
          cartTotal,
          cartItems,
          config,
          context,
        );
        available = eligibility.eligible;
        unavailableReason = eligibility.reason;
      }

      methods.push({
        method: config.method,
        label: this.getMethodLabel(config.method),
        fee: fee / 100, // Convert from paise to rupees
        breakdown: {
          ...breakdown,
          flatAmount: breakdown.flatAmount
            ? breakdown.flatAmount / 100
            : undefined,
          calculatedFee: breakdown.calculatedFee / 100,
          mixMin: breakdown.mixMin ? breakdown.mixMin / 100 : undefined,
          mixCap: breakdown.mixCap ? breakdown.mixCap / 100 : undefined,
        },
        available,
        unavailableReason,
      });
    }

    return methods;
  }

  /**
   * Validate COD eligibility based on restrictions
   * Implements all 7 restriction checks in order:
   * 1. Digital products check
   * 2. Preorder items check
   * 3. Cart total max amount check
   * 4. International address check
   * 5. Restricted states check
   * 6. Shipping zone COD availability check
   * 7. Customer group override check
   */
  async validateCodEligibility(
    cartTotal: number, // in paise
    cartItems: CartItem[],
    chargeConfig: typeof paymentMethodCharges.$inferSelect,
    context?: CodEligibilityContext,
  ): Promise<{ eligible: boolean; reason?: string }> {
    // Check 1: Digital products restriction
    if (chargeConfig.codDisallowDigital && cartItems.length > 0) {
      const variantIds = cartItems.map((item) => item.productVariantId);
      const variantsWithProducts = await this.db
        .select({
          variantId: productVariants.id,
          productId: productVariants.productId,
          isDigital: products.isDigital,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(inArray(productVariants.id, variantIds));

      const hasDigitalProduct = variantsWithProducts.some(
        (v) => v.isDigital === true,
      );

      if (hasDigitalProduct) {
        const reason = "COD not available for digital products";
        // Audit log restriction
        if (this.auditService) {
          this.auditService
            .logMethodRestricted(
              context?.checkoutId || "unknown",
              "COD",
              reason,
              cartTotal,
            )
            .catch((error) => {
              this.logger.warn(
                { error },
                "Failed to log COD restriction for digital products",
              );
            });
        }
        return {
          eligible: false,
          reason,
        };
      }
    }

    // Check 2: Preorder items restriction
    if (chargeConfig.codDisallowPreorder && cartItems.length > 0) {
      const variantIds = cartItems.map((item) => item.productVariantId);
      const variantsWithProducts = await this.db
        .select({
          variantId: productVariants.id,
          productId: productVariants.productId,
          isPreorder: products.isPreorder,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(inArray(productVariants.id, variantIds));

      const hasPreorder = variantsWithProducts.some(
        (v) => v.isPreorder === true,
      );

      if (hasPreorder) {
        const reason = "COD not available for preorder items";
        // Audit log restriction
        if (this.auditService) {
          this.auditService
            .logMethodRestricted(
              context?.checkoutId || "unknown",
              "COD",
              reason,
              cartTotal,
            )
            .catch((error) => {
              this.logger.warn(
                { error },
                "Failed to log COD restriction for preorder items",
              );
            });
        }
        return {
          eligible: false,
          reason,
        };
      }
    }

    // Check 3: Cart total max amount restriction
    if (
      chargeConfig.codMaxAmount !== null &&
      chargeConfig.codMaxAmount !== undefined &&
      cartTotal > chargeConfig.codMaxAmount
    ) {
      return {
        eligible: false,
        reason: `COD not available for orders above ₹${chargeConfig.codMaxAmount / 100}`,
      };
    }

    // Check 4: International address restriction
    if (
      chargeConfig.codDisallowInternational &&
      context?.shippingAddress?.country &&
      context.shippingAddress.country.toLowerCase() !== "india"
    ) {
      return {
        eligible: false,
        reason: "COD not available for international addresses",
      };
    }

    // Check 5: Restricted states check
    if (
      chargeConfig.codRestrictedStates &&
      Array.isArray(chargeConfig.codRestrictedStates) &&
      chargeConfig.codRestrictedStates.length > 0 &&
      context?.shippingAddress?.state
    ) {
      const restrictedStates = chargeConfig.codRestrictedStates.map((s) =>
        s.toLowerCase(),
      );
      if (
        restrictedStates.includes(context.shippingAddress.state.toLowerCase())
      ) {
        return {
          eligible: false,
          reason: `COD not available in ${context.shippingAddress.state}`,
        };
      }
    }

    // Check 6: Shipping zone COD availability
    // This is checked via pincode serviceability - if pincode says COD unavailable, disable it
    if (context?.shippingAddress?.pincode) {
      try {
        // Import pincode serviceability check
        const { checkPincodeServiceability } = await import(
          "../../../common/utils/pincode.utils"
        );
        const serviceability = await checkPincodeServiceability(
          context.shippingAddress.pincode,
        );
        if (serviceability.codAvailable === false) {
          return {
            eligible: false,
            reason: "COD not available for this PIN code",
          };
        }
      } catch (error) {
        // Log but don't fail - if pincode check fails, allow COD
        this.logger.warn(
          {
            pincode: context.shippingAddress.pincode,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to check pincode serviceability for COD",
        );
      }
    }

    // Check 7: Customer group override (VIP can bypass restrictions)
    if (
      context?.customerGroupIds &&
      chargeConfig.codAllowedCustomerGroups &&
      Array.isArray(chargeConfig.codAllowedCustomerGroups) &&
      chargeConfig.codAllowedCustomerGroups.length > 0
    ) {
      const allowedGroups = chargeConfig.codAllowedCustomerGroups;
      const hasAllowedGroup = context.customerGroupIds.some((groupId) =>
        allowedGroups.includes(groupId),
      );
      if (hasAllowedGroup) {
        // VIP customer group - allow COD despite restrictions
        return { eligible: true };
      }
    }

    return { eligible: true };
  }

  /**
   * Get human-readable label for payment method
   */
  private getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      COD: "Cash on Delivery",
      RAZORPAY_UPI: "UPI",
      RAZORPAY_CARD: "Card (Razorpay)",
      STRIPE_CARD: "Card (Stripe)",
      WALLET: "Wallet",
      NETBANKING: "Net Banking",
      BNPL: "Buy Now Pay Later",
    };
    return labels[method] || method;
  }
}
