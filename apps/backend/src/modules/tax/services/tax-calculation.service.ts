import { Inject, Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  calculateGstBreakdown,
  calculateOrderGst,
} from "../../../common/utils/gst.utils";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import type { VariantTaxInput } from "../engine/tax-engine.types";
import { TaxResolutionService } from "./tax-resolution.service";

/**
 * Service for tax calculations integrating with existing GST utils
 * This service bridges the old GST calculation system with the new tax engine
 */
@Injectable()
export class TaxCalculationService {
  constructor(
    @Inject(DB_TOKEN) readonly _db: Database,
    private readonly taxResolutionService: TaxResolutionService,
    private readonly logger: PinoLogger,
    readonly _contextService: ContextService,
  ) {}

  /**
   * Calculate tax for order items using tax engine
   * This replaces the old calculateOrderGst function with dynamic tax resolution
   */
  async calculateOrderTax(params: {
    items: Array<{
      variantId: string;
      price: number;
      quantity: number;
      gstRate?: number; // Fallback GST rate if tax engine fails
    }>;
    customerId: string | null;
    sellerState: string;
    buyerState: string;
  }): Promise<{
    totalBaseAmount: number;
    totalTaxAmount: number;
    taxBreakdown: {
      cgst: number;
      sgst: number;
      igst: number;
    };
    itemBreakdowns: Array<{
      variantId: string;
      baseAmount: number;
      taxAmount: number;
      taxBreakdown: {
        cgst: number;
        sgst: number;
        igst: number;
      };
    }>;
  }> {
    try {
      // Build variant tax inputs
      const variantTaxInputs: VariantTaxInput[] = await Promise.all(
        params.items.map(async (item) => {
          // Fetch variant details if needed
          // For now, use provided data
          return {
            variantId: item.variantId,
            productId: "", // Would be fetched from DB
            categoryId: null, // Would be fetched from DB
            baseGstRate: item.gstRate || 0,
            baseAmount: item.price,
            quantity: item.quantity,
          };
        }),
      );

      // Resolve tax using tax engine
      const taxResult = await this.taxResolutionService.resolveTax({
        variants: variantTaxInputs,
        customerId: params.customerId,
        sellerState: params.sellerState,
        buyerState: params.buyerState,
      });

      // Transform to old format for backward compatibility
      return {
        totalBaseAmount: taxResult.totalBaseAmount,
        totalTaxAmount: taxResult.totalTaxAmount,
        taxBreakdown: taxResult.taxBreakdown,
        itemBreakdowns: taxResult.variantTaxes.map((vt) => ({
          variantId: vt.variantId,
          baseAmount: vt.baseAmount,
          taxAmount: vt.taxAmount,
          taxBreakdown: vt.taxBreakdown,
        })),
      };
    } catch (error) {
      // Fallback to old GST calculation if tax engine fails
      this.logger.warn(
        {
          error,
          params,
        },
        "Tax engine failed, falling back to basic GST calculation",
      );

      // Use old calculation as fallback
      const oldResult = calculateOrderGst(
        params.items.map((item) => ({
          basePrice: item.price,
          quantity: item.quantity,
          gstRate: item.gstRate || 0,
        })),
        params.sellerState,
        params.buyerState,
      );

      return {
        totalBaseAmount: oldResult.totalBaseAmount,
        totalTaxAmount: oldResult.totalGstAmount,
        taxBreakdown: oldResult.gstBreakdown,
        itemBreakdowns: oldResult.itemBreakdowns.map((item, idx) => ({
          variantId: params.items[idx]?.variantId || "",
          baseAmount: item.baseAmount,
          taxAmount: item.gstAmount,
          taxBreakdown: item.gstBreakdown,
        })),
      };
    }
  }

  /**
   * Calculate complete order tax including shipping
   */
  async calculateCompleteOrderTax(params: {
    productItems: Array<{
      variantId: string;
      price: number;
      quantity: number;
      gstRate?: number;
    }>;
    shippingAmount: number;
    customerId: string | null;
    sellerState: string;
    buyerState: string;
  }): Promise<{
    products: {
      totalBaseAmount: number;
      totalTaxAmount: number;
      taxBreakdown: {
        cgst: number;
        sgst: number;
        igst: number;
      };
    };
    shipping: {
      baseAmount: number;
      gstRate: number;
      taxAmount: number;
      igst: number;
    };
    totals: {
      totalBaseAmount: number;
      totalTaxAmount: number;
      totalAmountWithTax: number;
      taxBreakdown: {
        cgst: number;
        sgst: number;
        igst: number;
      };
    };
  }> {
    // Calculate product tax using tax engine
    const productTax = await this.calculateOrderTax({
      items: params.productItems,
      customerId: params.customerId,
      sellerState: params.sellerState,
      buyerState: params.buyerState,
    });

    // Calculate shipping tax (always IGST, 18%)
    const shippingGst = calculateGstBreakdown(
      params.shippingAmount,
      18,
      params.sellerState,
      params.buyerState,
    );

    // Combine results
    const totalBaseAmount = productTax.totalBaseAmount + params.shippingAmount;
    const totalTaxAmount = productTax.totalTaxAmount + shippingGst.totalGst;

    return {
      products: {
        totalBaseAmount: productTax.totalBaseAmount,
        totalTaxAmount: productTax.totalTaxAmount,
        taxBreakdown: productTax.taxBreakdown,
      },
      shipping: {
        baseAmount: params.shippingAmount,
        gstRate: 18,
        taxAmount: shippingGst.totalGst,
        igst: shippingGst.igst,
      },
      totals: {
        totalBaseAmount,
        totalTaxAmount,
        totalAmountWithTax: totalBaseAmount + totalTaxAmount,
        taxBreakdown: {
          cgst: productTax.taxBreakdown.cgst,
          sgst: productTax.taxBreakdown.sgst,
          igst: productTax.taxBreakdown.igst + shippingGst.igst,
        },
      },
    };
  }
}
