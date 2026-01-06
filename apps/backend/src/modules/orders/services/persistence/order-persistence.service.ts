import { Inject, Injectable } from "@nestjs/common";
import {
  desc,
  eq,
  ilike,
  orderItems,
  orders,
  payments,
  products,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { AuditLogService } from "../../../../common/audit/audit-log.service";
import { COD_PAYMENT_METHOD } from "../../../../common/constants/orders.constants";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { calculateGstBreakdown } from "../../../../common/utils/gst.utils";
import type { Database } from "../../../../modules/database/db";
import { BundleCartItemMetadata } from "../../../carts/dto/bundle-cart-item.dto";
import { DB_TOKEN } from "../../../database/database.module";
import { DiscountSnapshot } from "../../../discounts/engine/discount-engine.types";
import { PricingSnapshot } from "../../../pricing/engine/pricing-engine.types";
import { BundlePricingService } from "../../../pricing/services/bundle-pricing.service";
import { PricingSnapshotDto } from "../../dto/enriched-order-item.dto";

/**
 * Service responsible for persisting orders and order items to database
 * Handles order creation, order items creation, and order number generation
 */
@Injectable()
export class OrderPersistenceService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly bundlePricingService: BundlePricingService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Generate unique order number
   * Format: ORD-YYYY-NNNNNN (e.g., ORD-2025-001234)
   */
  @Trace({ operation: "OrderPersistenceService.generateOrderNumber" })
  async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;

    // Get the latest order number for this year
    const latestOrders = await this.db
      .select({ orderNumber: orders.orderNumber })
      .from(orders)
      .where(ilike(orders.orderNumber, `${prefix}%`))
      .orderBy(desc(orders.createdAt))
      .limit(1);

    let sequence = 1;
    if (latestOrders.length > 0) {
      const latestNumber = latestOrders[0].orderNumber;
      const sequenceStr = latestNumber.replace(prefix, "");
      const parsedSequence = parseInt(sequenceStr, 10);
      if (!Number.isNaN(parsedSequence)) {
        sequence = parsedSequence + 1;
      }
    }

    // Format sequence as 6-digit number
    const formattedSequence = sequence.toString().padStart(6, "0");
    return `${prefix}${formattedSequence}`;
  }

  /**
   * Persist order to database
   */
  @Trace({ operation: "OrderPersistenceService.persistOrder" })
  async persistOrder(
    customerId: string,
    orderData: {
      subtotal: number;
      gstAmount: number;
      discountCode: string | null;
      discountAmount: number;
      shippingCost: number;
      paymentFee: number;
      paymentMethod: string | null;
      paymentFeeBreakdown: unknown;
      total: number;
      shippingAddressId: string;
      billingAddressId: string;
      razorpayOrderId?: string | null;
      discountSnapshot?: DiscountSnapshot | null;
      pricingSnapshot?: PricingSnapshot | null;
    },
  ): Promise<{ id: string; orderNumber: string }> {
    const orderNumber = await this.generateOrderNumber();

    const orderResult = await this.db
      .insert(orders)
      .values({
        customerId,
        orderNumber,
        status: "pending",
        subtotal: orderData.subtotal,
        gstAmount: orderData.gstAmount,
        discountCode: orderData.discountCode,
        discountAmount: orderData.discountAmount,
        shippingCost: orderData.shippingCost,
        paymentFee: orderData.paymentFee,
        paymentMethod: orderData.paymentMethod,
        paymentFeeBreakdown: orderData.paymentFeeBreakdown,
        total: orderData.total,
        shippingAddressId: orderData.shippingAddressId,
        billingAddressId: orderData.billingAddressId,
        razorpayOrderId: orderData.razorpayOrderId ?? null,
        discountSnapshot: orderData.discountSnapshot,
        pricingSnapshot: orderData.pricingSnapshot,
      })
      .returning();

    const order = orderResult[0];
    if (!order) {
      throw new Error("Failed to create order");
    }

    this.logger.info(
      createLogContext(this.contextService, "persistOrder", {
        orderId: order.id,
        orderNumber,
        customerId,
      }),
      "Order persisted to database",
    );

    // Log audit event
    await this.auditLogService.logOrderCreation(order.id, customerId, {
      orderNumber,
      total: orderData.total,
      paymentMethod: orderData.paymentMethod,
    });

    return { id: order.id, orderNumber };
  }

  /**
   * Persist order items to database
   * Handles both variant items and bundle items
   */
  @Trace({ operation: "OrderPersistenceService.persistOrderItems" })
  async persistOrderItems(
    orderId: string,
    variantItems: Array<{
      productVariantId: string;
      quantity: number;
      price: number;
      productGstRate: number;
      pricingSnapshot?: PricingSnapshotDto;
    }>,
    bundleItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>,
    sellerState: string,
    buyerState: string,
    pricingSnapshot?: PricingSnapshot | null,
  ): Promise<void> {
    const orderItemsToInsert: Array<{
      orderId: string;
      productVariantId: string;
      quantity: number;
      price: number;
      gstRate: number;
      gstAmount: number;
      metadata?: unknown;
    }> = [];

    // Process variant items
    for (const item of variantItems) {
      const itemSubtotal = item.price * item.quantity;
      const gstBreakdown = calculateGstBreakdown(
        itemSubtotal,
        item.productGstRate,
        sellerState,
        buyerState,
      );

      orderItemsToInsert.push({
        orderId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        price: item.price,
        gstRate: item.productGstRate,
        gstAmount: gstBreakdown.totalGst,
        metadata: item.pricingSnapshot
          ? { pricingSnapshot: item.pricingSnapshot }
          : undefined,
      });
    }

    // Process bundle items
    for (const bundleItem of bundleItems) {
      const bundleMetadata = bundleItem.metadata as BundleCartItemMetadata;
      const bundleBreakdown =
        pricingSnapshot?.bundleBreakdowns?.find(
          (b) => b.bundleLineId === bundleItem.id,
        ) ||
        pricingSnapshot?.bundleBreakdowns?.find(
          (b) => b.bundleId === bundleMetadata.bundleId,
        );

      if (bundleBreakdown) {
        // Use snapshot breakdown
        for (const variantBreakdown of bundleBreakdown.variantBreakdown) {
          const [variant] = await this.db
            .select({
              productId: productVariants.productId,
            })
            .from(productVariants)
            .where(eq(productVariants.id, variantBreakdown.variantId))
            .limit(1);

          if (variant) {
            const [product] = await this.db
              .select({
                gstRate: products.gstRate,
              })
              .from(products)
              .where(eq(products.id, variant.productId))
              .limit(1);

            if (product) {
              const itemSubtotal =
                variantBreakdown.unitPrice * variantBreakdown.quantity;
              const gstBreakdown = calculateGstBreakdown(
                itemSubtotal,
                product.gstRate,
                sellerState,
                buyerState,
              );

              // Find which set this variant belongs to
              let setId: string | undefined;
              for (const [setIdKey, variantIds] of Object.entries(
                bundleMetadata.selections,
              )) {
                if (variantIds.includes(variantBreakdown.variantId)) {
                  setId = setIdKey;
                  break;
                }
              }

              orderItemsToInsert.push({
                orderId,
                productVariantId: variantBreakdown.variantId,
                quantity: variantBreakdown.quantity,
                price: variantBreakdown.unitPrice,
                gstRate: product.gstRate,
                gstAmount: gstBreakdown.totalGst,
                metadata: {
                  bundleId: bundleMetadata.bundleId,
                  bundleLineId: bundleItem.id,
                  setId,
                  isBundleComponent: true,
                } as unknown as Record<string, unknown>,
              });
            }
          }
        }
      } else {
        // Fallback: flatten bundle manually if snapshot not available
        const variantQuantities =
          this.bundlePricingService.flattenBundleSelections(
            bundleMetadata.selections,
            bundleItem.quantity,
          );

        for (const vq of variantQuantities) {
          const [variant] = await this.db
            .select({
              productId: productVariants.productId,
            })
            .from(productVariants)
            .where(eq(productVariants.id, vq.variantId))
            .limit(1);

          if (variant) {
            const [product] = await this.db
              .select({
                gstRate: products.gstRate,
              })
              .from(products)
              .where(eq(products.id, variant.productId))
              .limit(1);

            if (product) {
              // Use unit bundle price divided by variant count
              const unitPrice = bundleItem.price / variantQuantities.length;
              const itemSubtotal = unitPrice * vq.quantity;
              const gstBreakdown = calculateGstBreakdown(
                itemSubtotal,
                product.gstRate,
                sellerState,
                buyerState,
              );

              // Find which set this variant belongs to
              let setId: string | undefined;
              for (const [setIdKey, variantIds] of Object.entries(
                bundleMetadata.selections,
              )) {
                if (variantIds.includes(vq.variantId)) {
                  setId = setIdKey;
                  break;
                }
              }

              orderItemsToInsert.push({
                orderId,
                productVariantId: vq.variantId,
                quantity: vq.quantity,
                price: unitPrice,
                gstRate: product.gstRate,
                gstAmount: gstBreakdown.totalGst,
                metadata: {
                  bundleId: bundleMetadata.bundleId,
                  bundleLineId: bundleItem.id,
                  setId,
                  isBundleComponent: true,
                } as unknown as Record<string, unknown>,
              });
            }
          }
        }
      }
    }

    await this.db.insert(orderItems).values(orderItemsToInsert);

    this.logger.info(
      createLogContext(this.contextService, "persistOrderItems", {
        orderId,
        itemsCount: orderItemsToInsert.length,
      }),
      "Order items persisted to database",
    );
  }

  /**
   * Create COD payment record
   */
  @Trace({ operation: "OrderPersistenceService.createCodPayment" })
  async createCodPayment(orderId: string, total: number): Promise<void> {
    await this.db.insert(payments).values({
      orderId,
      method: COD_PAYMENT_METHOD,
      status: "pending",
      amount: total, // Amount in rupees (real type)
      razorpayPaymentId: null,
      razorpayOrderId: null,
    });

    this.logger.info(
      createLogContext(this.contextService, "createCodPayment", {
        orderId,
        total,
      }),
      "COD payment record created",
    );
  }

  /**
   * Delete order (for handling concurrent creation conflicts)
   */
  @Trace({ operation: "OrderPersistenceService.deleteOrder" })
  async deleteOrder(orderId: string): Promise<void> {
    try {
      await this.db.delete(orders).where(eq(orders.id, orderId));
      this.logger.warn(
        createLogContext(this.contextService, "deleteOrder", {
          orderId,
        }),
        "Order deleted due to concurrent creation conflict",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "deleteOrder", error, {
          orderId,
        }),
        "Failed to delete order",
      );
      throw error;
    }
  }
}
