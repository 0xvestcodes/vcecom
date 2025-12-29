import { Inject, Injectable } from "@nestjs/common";
import { addresses, eq, payments } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { PAISE_PER_RUPEE } from "../../../common/constants/currency.constants";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { calculateGstBreakdown } from "../../../common/utils/gst.utils";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { ProductEnrichmentService } from "../../products/services/product-enrichment.service";
import {
  EnrichedOrderItemDto,
  PricingSnapshotDto,
} from "../dto/enriched-order-item.dto";

/**
 * Service responsible for enriching order data with product details, addresses, and related entities
 */
@Injectable()
export class OrderEnrichmentService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly productEnrichmentService: ProductEnrichmentService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Enrich order items with product variant data
   * @param items - Order items from database
   * @param sellerState - Seller's state for GST calculation
   * @param buyerState - Buyer's state for GST calculation
   * @returns Enriched order items with product details
   */
  async enrichOrderItems(
    items: Array<{
      id: string;
      orderId: string;
      productVariantId: string;
      quantity: number;
      price: number;
      gstRate: number;
      gstAmount: number;
      metadata: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>,
    sellerState: string,
    buyerState: string,
  ): Promise<EnrichedOrderItemDto[]> {
    // Enrich items with product data
    const variantIds = items.map((item) => item.productVariantId);
    const enrichedVariants =
      await this.productEnrichmentService.enrichVariants(variantIds);
    const enrichedVariantsMap = new Map(
      enrichedVariants.map((v) => [v.variantId, v]),
    );

    // Build enriched items
    const enrichedItems = items.map((item) => {
      const enrichedVariant = enrichedVariantsMap.get(item.productVariantId);
      const itemSubtotal = item.price * item.quantity;
      const itemGstBreakdown = calculateGstBreakdown(
        itemSubtotal,
        item.gstRate,
        sellerState,
        buyerState,
      );

      // Read pricing snapshot from item metadata if available
      let pricingSnapshot: PricingSnapshotDto | undefined;
      const itemMetadata = item.metadata as
        | { pricingSnapshot?: PricingSnapshotDto }
        | null
        | undefined;
      if (
        itemMetadata &&
        typeof itemMetadata === "object" &&
        "pricingSnapshot" in itemMetadata
      ) {
        const storedSnapshot = itemMetadata.pricingSnapshot;
        if (storedSnapshot) {
          pricingSnapshot = storedSnapshot;
        }
      }

      // Fallback: construct basic snapshot if not stored
      if (!pricingSnapshot) {
        pricingSnapshot = {
          basePrice: Number(item.price),
          compareAtPrice: enrichedVariant?.compareAtPrice || null,
          savings: 0,
        };
      }

      return {
        id: item.id,
        orderId: item.orderId,
        variantId: item.productVariantId,
        productId: enrichedVariant?.productId || "",
        productTitle: enrichedVariant?.productTitle || "Product",
        productSlug: enrichedVariant?.productSlug || "",
        variantTitle: enrichedVariant?.variantTitle || null,
        sku: enrichedVariant?.sku || "",
        attributes: enrichedVariant?.attributes || {},
        thumbnail: enrichedVariant?.thumbnail || null,
        quantity: item.quantity,
        unitPrice: Number(item.price),
        lineTotal: itemSubtotal,
        pricingSnapshot,
        gstRate: item.gstRate,
        gstAmount: item.gstAmount,
        gstBreakdown: {
          cgst: itemGstBreakdown.cgst,
          sgst: itemGstBreakdown.sgst,
          igst: itemGstBreakdown.igst,
        },
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return enrichedItems;
  }

  /**
   * Fetch shipping and billing addresses for an order
   * @param shippingAddressId - Shipping address ID
   * @param billingAddressId - Billing address ID
   * @returns Shipping and billing address data
   */
  async fetchOrderAddresses(
    shippingAddressId: string,
    billingAddressId: string,
  ): Promise<{
    shippingAddress: typeof addresses.$inferSelect | undefined;
    billingAddress: typeof addresses.$inferSelect | undefined;
  }> {
    let shippingAddressData: typeof addresses.$inferSelect | undefined;
    let billingAddressData: typeof addresses.$inferSelect | undefined;

    try {
      const [shippingAddr] = await this.db
        .select()
        .from(addresses)
        .where(eq(addresses.id, shippingAddressId))
        .limit(1);
      shippingAddressData = shippingAddr;

      if (billingAddressId !== shippingAddressId) {
        const [billingAddr] = await this.db
          .select()
          .from(addresses)
          .where(eq(addresses.id, billingAddressId))
          .limit(1);
        billingAddressData = billingAddr;
      } else {
        billingAddressData = shippingAddressData;
      }
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "OrderEnrichmentService.fetchOrderAddresses",
          {
            shippingAddressId,
            billingAddressId,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to fetch addresses",
      );
    }

    return {
      shippingAddress: shippingAddressData,
      billingAddress: billingAddressData,
    };
  }

  /**
   * Fetch shipping address state for GST calculation
   * @param shippingAddressId - Shipping address ID
   * @returns State string or undefined
   */
  async fetchShippingAddressState(
    shippingAddressId: string,
  ): Promise<string | undefined> {
    try {
      const addressResult = await this.db
        .select({ state: addresses.state })
        .from(addresses)
        .where(eq(addresses.id, shippingAddressId))
        .limit(1);
      return addressResult[0]?.state;
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "OrderEnrichmentService.fetchShippingAddressState",
          {
            shippingAddressId,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to fetch shipping address, using default state",
      );
      return undefined;
    }
  }

  /**
   * Build payment details for an order
   * @param order - Order record
   * @param paymentFeeBreakdown - Payment fee breakdown (optional)
   * @returns Payment details object
   */
  async buildPaymentDetails(
    order: {
      paymentMethod: string | null;
      razorpayOrderId: string | null;
      paymentFee: number | null;
    },
    paymentFeeBreakdown?: {
      method?: string;
      chargeType: string;
      calculatedFee?: number;
      amount?: number;
      flatAmount?: number;
      percentage?: number;
      mixMin?: number;
      mixCap?: number;
    } | null,
  ): Promise<{
    method: string;
    status: string;
    transactionId: string | null;
    paidAt: Date | null;
    feeBreakdown: {
      chargeType: string;
      amount: number;
      percentage?: number;
    };
  }> {
    const paymentDetails: {
      method: string;
      status: string;
      transactionId: string | null;
      paidAt: Date | null;
      feeBreakdown: {
        chargeType: string;
        amount: number;
        percentage?: number;
      };
    } = {
      method: order.paymentMethod || "unknown",
      status: "pending",
      transactionId: null,
      paidAt: null,
      feeBreakdown: {
        chargeType: paymentFeeBreakdown?.chargeType || "NONE",
        amount:
          paymentFeeBreakdown && "amount" in paymentFeeBreakdown
            ? (paymentFeeBreakdown.amount ?? 0)
            : paymentFeeBreakdown && "calculatedFee" in paymentFeeBreakdown
              ? (paymentFeeBreakdown.calculatedFee ?? 0) / PAISE_PER_RUPEE
              : order.paymentFee
                ? Number(order.paymentFee) / PAISE_PER_RUPEE
                : 0,
        percentage: paymentFeeBreakdown?.percentage,
      },
    };

    if (order.razorpayOrderId) {
      try {
        const payment = await this.db
          .select()
          .from(payments)
          .where(eq(payments.razorpayOrderId, order.razorpayOrderId))
          .limit(1);
        if (payment[0]) {
          paymentDetails.status = payment[0].status || "pending";
          paymentDetails.transactionId = payment[0].razorpayPaymentId || null;
          // paidAt not in payments table - use updatedAt if status is captured
          paymentDetails.paidAt =
            payment[0].status === "captured" ? payment[0].updatedAt : null;
        }
      } catch (error) {
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "OrderEnrichmentService.buildPaymentDetails",
            error,
            {
              razorpayOrderId: order.razorpayOrderId,
            },
          ),
          "Failed to fetch payment details",
        );
      }
    }

    return paymentDetails;
  }

  /**
   * Build shipping details for an order
   * @param order - Order record
   * @returns Shipping details object
   */
  buildShippingDetails(order: {
    shippingProvider: string | null;
    status: string;
    updatedAt: Date;
  }): {
    provider: string | null;
    method: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    estimatedDelivery: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
  } {
    return {
      provider: order.shippingProvider || null,
      method: null,
      trackingNumber: null,
      trackingUrl: null,
      estimatedDelivery: null,
      shippedAt: order.status === "shipped" ? order.updatedAt : null,
      deliveredAt: order.status === "delivered" ? order.updatedAt : null,
    };
  }

  /**
   * Transform address data to response format
   * @param addressData - Address data from database
   * @returns Address in response format
   */
  transformAddressToResponse(
    addressData: typeof addresses.$inferSelect | undefined,
  ):
    | {
        id: string;
        fullName: string;
        addressLine1: string;
        addressLine2: string | null;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        phone: string;
      }
    | undefined {
    if (!addressData) {
      return undefined;
    }

    return {
      id: addressData.id,
      fullName: "", // Not stored in addresses table
      addressLine1: addressData.street,
      addressLine2: addressData.district || null,
      city: addressData.city,
      state: addressData.state,
      postalCode: addressData.pincode,
      country: addressData.country,
      phone: "", // Not stored in addresses table
    };
  }
}
