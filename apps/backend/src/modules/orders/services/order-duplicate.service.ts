import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  desc,
  eq,
  ilike,
  orderItems,
  orders,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { BundleCartItemMetadata } from "../../carts/dto/bundle-cart-item.dto";
import { BundlePricingService } from "../../pricing/services/bundle-pricing.service";
import { InventoryStore } from "../../redis-store/stores/inventory-store";
import { DuplicateOrderDto } from "../dto/duplicate-order.dto";
import { OrderResponseDto } from "../dto/order-response.dto";
import { TimelineEventType } from "../dto/order-timeline.dto";
import { OrderGstService } from "./order-gst.service";
import { OrderTimelineService } from "./order-timeline.service";
import { OrderValidationService } from "./order-validation.service";

/**
 * Service responsible for duplicating orders
 * Creates a new order based on an existing order with same items
 */
@Injectable()
export class OrderDuplicateService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly validationService: OrderValidationService,
    private readonly inventoryStore: InventoryStore,
    private readonly timelineService: OrderTimelineService,
    private readonly gstService: OrderGstService,
    private readonly bundlePricingService: BundlePricingService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Generate unique order number
   * Format: ORD-YYYY-NNNNNN (e.g., ORD-2025-001234)
   */
  private async generateOrderNumber(): Promise<string> {
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
   * Duplicate order (customer)
   * @param userId - User ID
   * @param orderId - Order ID
   * @param duplicateDto - Duplication options
   * @returns New order
   */
  async duplicateOrder(
    userId: string,
    orderId: string,
    duplicateDto: DuplicateOrderDto,
  ): Promise<OrderResponseDto> {
    const customerId = await this.validationService.getCustomerId(userId);

    // Get original order and validate ownership
    const [originalOrder] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!originalOrder) {
      throw new NotFoundException("Order not found");
    }

    return this.processDuplication(
      originalOrder,
      duplicateDto,
      customerId,
      false,
    );
  }

  /**
   * Duplicate order (admin)
   * @param orderId - Order ID
   * @param duplicateDto - Duplication options
   * @returns New order
   */
  async duplicateOrderForAdmin(
    orderId: string,
    duplicateDto: DuplicateOrderDto,
  ): Promise<OrderResponseDto> {
    // Get original order (no customer validation for admin)
    const [originalOrder] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!originalOrder) {
      throw new NotFoundException("Order not found");
    }

    return this.processDuplication(
      originalOrder,
      duplicateDto,
      originalOrder.customerId,
      true,
    );
  }

  /**
   * Process order duplication
   * @param originalOrder - Original order
   * @param duplicateDto - Duplication options
   * @param customerId - Customer ID for new order
   * @param isAdmin - Whether actor is admin
   * @returns New order
   */
  private async processDuplication(
    originalOrder: typeof orders.$inferSelect,
    duplicateDto: DuplicateOrderDto,
    customerId: string,
    isAdmin: boolean,
  ): Promise<OrderResponseDto> {
    // Get original order items
    const originalItems = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, originalOrder.id));

    if (originalItems.length === 0) {
      throw new BadRequestException("Original order has no items to duplicate");
    }

    // Check inventory availability for all items
    for (const item of originalItems) {
      if (item.metadata) {
        const metadata = item.metadata as BundleCartItemMetadata | null;
        if (metadata?.type === "bundle" && metadata.selections) {
          // Check bundle items
          const variantQuantities =
            this.bundlePricingService.flattenBundleSelections(
              metadata.selections,
              item.quantity,
            );

          for (const vq of variantQuantities) {
            const available = await this.inventoryStore.getAvailableInventory(
              vq.variantId,
            );
            const reserved = await this.inventoryStore.getReservedInventory(
              vq.variantId,
            );
            const actuallyAvailable = (available || 0) - reserved;

            if (actuallyAvailable < vq.quantity) {
              throw new BadRequestException(
                `Insufficient inventory for variant ${vq.variantId}. Available: ${actuallyAvailable}, Required: ${vq.quantity}`,
              );
            }
          }
        } else {
          // Check regular variant
          const available = await this.inventoryStore.getAvailableInventory(
            item.productVariantId,
          );
          const reserved = await this.inventoryStore.getReservedInventory(
            item.productVariantId,
          );
          const actuallyAvailable = (available || 0) - reserved;

          if (actuallyAvailable < item.quantity) {
            const [variant] = await this.db
              .select()
              .from(productVariants)
              .where(eq(productVariants.id, item.productVariantId))
              .limit(1);

            throw new BadRequestException(
              `Insufficient inventory for ${variant?.sku || item.productVariantId}. Available: ${actuallyAvailable}, Required: ${item.quantity}`,
            );
          }
        }
      } else {
        // Check regular variant (no metadata)
        const available = await this.inventoryStore.getAvailableInventory(
          item.productVariantId,
        );
        const reserved = await this.inventoryStore.getReservedInventory(
          item.productVariantId,
        );
        const actuallyAvailable = (available || 0) - reserved;

        if (actuallyAvailable < item.quantity) {
          const [variant] = await this.db
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, item.productVariantId))
            .limit(1);

          throw new BadRequestException(
            `Insufficient inventory for ${variant?.sku || item.productVariantId}. Available: ${actuallyAvailable}, Required: ${item.quantity}`,
          );
        }
      }
    }

    // Use addresses from DTO or original order
    const shippingAddressId =
      duplicateDto.shippingAddressId || originalOrder.shippingAddressId;
    const billingAddressId =
      duplicateDto.billingAddressId || originalOrder.billingAddressId;

    // Validate addresses exist
    // Note: Address validation should be done, but for now we'll trust the IDs
    // In production, you might want to validate addresses belong to customer

    // Generate new order number
    const orderNumber = await this.generateOrderNumber();

    // Calculate totals from original items (using current prices)
    // For simplicity, we'll use original prices but recalculate GST and totals
    let subtotal = 0;
    for (const item of originalItems) {
      subtotal += item.price * item.quantity;
    }

    // For now, use original shipping cost and discount
    // In a full implementation, you'd recalculate shipping and apply new discount code
    const shippingCost = originalOrder.shippingCost || 0;
    const discountAmount = originalOrder.discountAmount || 0;
    const discountCode =
      duplicateDto.discountCode || originalOrder.discountCode;

    // TODO: Recalculate discount if discountCode is provided
    // For now, we'll use original discount amount

    // Calculate GST (will be recalculated properly)
    const finalSubtotal = subtotal - discountAmount;
    // Use original GST calculation for now
    const gstAmount = originalOrder.gstAmount || 0;
    const paymentFee = originalOrder.paymentFee || 0;
    const total = finalSubtotal + gstAmount + shippingCost + paymentFee / 100;

    // Create new order
    const [newOrder] = await this.db
      .insert(orders)
      .values({
        customerId,
        orderNumber,
        status: "pending",
        subtotal,
        gstAmount,
        discountCode,
        discountAmount,
        shippingCost,
        paymentFee,
        paymentMethod: null, // Reset payment method
        paymentFeeBreakdown: null, // Reset payment fee breakdown
        total,
        shippingAddressId,
        billingAddressId,
        razorpayOrderId: null, // No payment intent yet
        discountSnapshot: null, // Will be recalculated during checkout
        pricingSnapshot: null, // Will be recalculated during checkout
        archived: false,
        archivedAt: null,
        archivedBy: null,
      })
      .returning();

    // Create order items
    const orderItemsToInsert = originalItems.map((item) => ({
      orderId: newOrder.id,
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      price: item.price, // Use original price for now
      gstRate: item.gstRate,
      gstAmount: item.gstAmount,
      metadata: item.metadata, // Preserve bundle metadata if present
    }));

    await this.db.insert(orderItems).values(orderItemsToInsert);

    // Create timeline event on original order
    await this.timelineService.addEvent(originalOrder.id, {
      type: TimelineEventType.STATUS_CHANGED,
      title: "Order Duplicated",
      description: `Order duplicated${isAdmin ? " by admin" : ""}. New order: ${orderNumber}`,
      actor: isAdmin ? "admin" : "customer",
      timestamp: new Date(),
      metadata: {
        duplicatedOrderId: newOrder.id,
        duplicatedOrderNumber: orderNumber,
      },
    });

    // Get order items for response
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, newOrder.id));

    // Get GST breakdown
    const gstBreakdown = await this.gstService.calculateOrderGstBreakdown(
      newOrder.id,
      newOrder.shippingAddressId,
    );

    this.logger.info(
      createLogContext(this.contextService, "duplicateOrder", {
        originalOrderId: originalOrder.id,
        originalOrderNumber: originalOrder.orderNumber,
        newOrderId: newOrder.id,
        newOrderNumber: orderNumber,
        itemsCount: items.length,
        isAdmin,
      }),
      "Order duplicated successfully",
    );

    return {
      ...newOrder,
      gstBreakdown,
      items,
    } as OrderResponseDto;
  }
}
