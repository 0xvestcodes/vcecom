import { Inject, Injectable } from "@nestjs/common";
import { eq, products, productVariants } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { PAISE_PER_RUPEE } from "../../../../common/constants/currency.constants";
import { ContextService } from "../../../../common/logging/context.service";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { calculateGstBreakdown } from "../../../../common/utils/gst.utils";
import type { Database } from "../../../../modules/database/db";
import { DB_TOKEN } from "../../../database/database.module";
import { DiscountSnapshot } from "../../../discounts/engine/discount-engine.types";
import { PaymentChargeService } from "../../../payments/services/payment-charge.service";
import { PricingSnapshot } from "../../../pricing/engine/pricing-engine.types";

/**
 * Service responsible for order calculations
 * Handles totals, GST breakdown, discounts, and payment fees
 */
@Injectable()
export class OrderCalculationService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly paymentChargeService: PaymentChargeService,
  ) {}

  /**
   * Calculate order totals from cart items
   */
  @Trace({ operation: "OrderCalculationService.calculateOrderTotals" })
  async calculateOrderTotals(
    variantItems: Array<{
      price: number;
      quantity: number;
      productGstRate: number;
    }>,
    bundleItems: Array<{
      price: number;
      quantity: number;
      productVariantId: string;
    }>,
    sellerState: string,
    buyerState: string,
  ): Promise<{
    subtotal: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalGstAmount: number;
  }> {
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    // Calculate subtotal and GST for variant items
    for (const item of variantItems) {
      const itemSubtotal = item.price * item.quantity;
      subtotal += itemSubtotal;

      const gstBreakdown = calculateGstBreakdown(
        itemSubtotal,
        item.productGstRate,
        sellerState,
        buyerState,
      );
      totalCgst += gstBreakdown.cgst;
      totalSgst += gstBreakdown.sgst;
      totalIgst += gstBreakdown.igst;
    }

    // Calculate subtotal and GST for bundle items
    for (const bundleItem of bundleItems) {
      const itemSubtotal = bundleItem.price * bundleItem.quantity;
      subtotal += itemSubtotal;

      // Get GST rate from first variant's product
      const [firstVariant] = await this.db
        .select({
          productId: productVariants.productId,
        })
        .from(productVariants)
        .where(eq(productVariants.id, bundleItem.productVariantId))
        .limit(1);

      if (firstVariant) {
        const [product] = await this.db
          .select({
            gstRate: products.gstRate,
          })
          .from(products)
          .where(eq(products.id, firstVariant.productId))
          .limit(1);

        if (product) {
          const gstBreakdown = calculateGstBreakdown(
            itemSubtotal,
            product.gstRate,
            sellerState,
            buyerState,
          );
          totalCgst += gstBreakdown.cgst;
          totalSgst += gstBreakdown.sgst;
          totalIgst += gstBreakdown.igst;
        }
      }
    }

    const totalGstAmount = totalCgst + totalSgst + totalIgst;

    return {
      subtotal,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGstAmount,
    };
  }

  /**
   * Calculate GST breakdown for order
   */
  @Trace({ operation: "OrderCalculationService.calculateGstBreakdown" })
  calculateGstBreakdown(
    subtotal: number,
    gstRate: number,
    sellerState: string,
    buyerState: string,
  ): {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    isIntraState: boolean;
  } {
    const breakdown = calculateGstBreakdown(
      subtotal,
      gstRate,
      sellerState,
      buyerState,
    );
    return {
      ...breakdown,
      isIntraState: sellerState === buyerState,
    };
  }

  /**
   * Apply discount snapshot to order totals
   */
  @Trace({ operation: "OrderCalculationService.applyDiscountSnapshot" })
  applyDiscountSnapshot(
    subtotal: number,
    discountSnapshot: DiscountSnapshot,
  ): {
    subtotalAfterDiscount: number;
    discountAmount: number;
    discountCode: string | null;
  } {
    const discountAmount = discountSnapshot.total;
    const subtotalAfterDiscount = subtotal - discountAmount;
    const discountCode =
      discountSnapshot.cartDiscounts.length > 0
        ? discountSnapshot.cartDiscounts[0].discountCode || null
        : null;

    return {
      subtotalAfterDiscount: Math.max(0, subtotalAfterDiscount),
      discountAmount,
      discountCode,
    };
  }

  /**
   * Calculate payment fee
   */
  @Trace({ operation: "OrderCalculationService.calculatePaymentFee" })
  async calculatePaymentFee(
    paymentMethod: string | null | undefined,
    cartTotalInPaise: number,
    currency: string = "INR",
    existingFee?: number,
    existingBreakdown?: unknown,
  ): Promise<{
    fee: number;
    breakdown: unknown;
  }> {
    if (existingFee !== undefined && existingBreakdown) {
      return {
        fee: existingFee,
        breakdown: existingBreakdown,
      };
    }

    if (!paymentMethod) {
      return {
        fee: 0,
        breakdown: null,
      };
    }

    const { fee, breakdown } = await this.paymentChargeService.calculateFee(
      paymentMethod,
      cartTotalInPaise,
      currency,
    );

    return {
      fee,
      breakdown,
    };
  }

  /**
   * Calculate final order total
   */
  @Trace({ operation: "OrderCalculationService.calculateFinalTotal" })
  calculateFinalTotal(
    subtotalAfterDiscount: number,
    totalGstAmount: number,
    shippingCost: number,
    paymentFee: number,
  ): number {
    return (
      subtotalAfterDiscount +
      totalGstAmount +
      shippingCost +
      paymentFee / PAISE_PER_RUPEE
    );
  }

  /**
   * Calculate effective subtotal from pricing snapshot
   */
  @Trace({
    operation: "OrderCalculationService.calculateEffectiveSubtotal",
  })
  calculateEffectiveSubtotal(
    variantItems: Array<{
      productVariantId: string;
      quantity: number;
      price: number;
    }>,
    bundleItems: Array<{
      id: string;
      price: number;
      quantity: number;
    }>,
    pricingSnapshot?: PricingSnapshot | null,
  ): number {
    let effectiveSubtotal = 0;

    // Calculate from variant items using pricing snapshot if available
    for (const item of variantItems) {
      if (pricingSnapshot) {
        const variantPrice = pricingSnapshot.variantPrices.find(
          (vp) => vp.variantId === item.productVariantId,
        );
        if (variantPrice) {
          effectiveSubtotal += variantPrice.effectivePrice * item.quantity;
        } else {
          effectiveSubtotal += item.price * item.quantity;
        }
      } else {
        effectiveSubtotal += item.price * item.quantity;
      }
    }

    // Add bundle items (use snapshot breakdown if available)
    for (const bundleItem of bundleItems) {
      if (pricingSnapshot?.bundleBreakdowns) {
        const bundleBreakdown = pricingSnapshot.bundleBreakdowns.find(
          (b) => b.bundleLineId === bundleItem.id,
        );
        if (bundleBreakdown) {
          // Calculate total from variant breakdown
          const bundleTotal = bundleBreakdown.variantBreakdown.reduce(
            (sum, vb) => sum + vb.unitPrice * vb.quantity,
            0,
          );
          effectiveSubtotal += bundleTotal * bundleItem.quantity;
        } else {
          effectiveSubtotal += bundleItem.price * bundleItem.quantity;
        }
      } else {
        effectiveSubtotal += bundleItem.price * bundleItem.quantity;
      }
    }

    return effectiveSubtotal;
  }
}
