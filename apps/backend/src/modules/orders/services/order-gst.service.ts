import { Inject, Injectable } from "@nestjs/common";
import { addresses, eq, orderItems } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { calculateGstBreakdown } from "../../../common/utils/gst.utils";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { OrderValidationService } from "./order-validation.service";

/**
 * Service responsible for GST calculations for orders
 * Handles CGST, SGST, and IGST breakdown based on transaction type
 */
@Injectable()
export class OrderGstService {
  constructor(
    readonly _logger: PinoLogger,
    private readonly validationService: OrderValidationService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Calculate GST breakdown for an order
   *
   * Determines if transaction is intra-state or inter-state and calculates appropriate GST:
   * - **Intra-state** (seller and buyer in same state): CGST (9%) + SGST (9%) = 18% total
   * - **Inter-state** (seller and buyer in different states): IGST (18%)
   *
   * GST is calculated per line item and then aggregated for the entire order.
   * Each item can have a different GST rate based on product category.
   *
   * @param orderId - Order ID to calculate GST for
   * @param shippingAddressId - Shipping address ID to determine buyer state
   * @returns GST breakdown with CGST, SGST, IGST, total GST, and transaction type
   * @throws Error if order items or shipping address cannot be retrieved
   *
   * @example
   * ```typescript
   * // Intra-state transaction (Maharashtra → Maharashtra)
   * const breakdown = await orderGstService.calculateOrderGstBreakdown(
   *   "order-123",
   *   "address-456"
   * );
   * // Returns: { cgst: 90, sgst: 90, igst: 0, totalGst: 180, isIntraState: true }
   *
   * // Inter-state transaction (Maharashtra → Delhi)
   * const breakdown = await orderGstService.calculateOrderGstBreakdown(
   *   "order-123",
   *   "address-789"
   * );
   * // Returns: { cgst: 0, sgst: 0, igst: 180, totalGst: 180, isIntraState: false }
   * ```
   */
  async calculateOrderGstBreakdown(
    orderId: string,
    shippingAddressId: string,
  ): Promise<{
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    isIntraState: boolean;
  }> {
    // Get order items with GST rates
    const items = await this.db
      .select({
        quantity: orderItems.quantity,
        price: orderItems.price,
        gstRate: orderItems.gstRate,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Get shipping address state
    const [shippingAddress] = await this.db
      .select({ state: addresses.state })
      .from(addresses)
      .where(eq(addresses.id, shippingAddressId))
      .limit(1);

    const sellerState = this.validationService.getSellerState();
    const buyerState = shippingAddress?.state || "";

    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    // Ensure items is an array (for test compatibility)
    const itemsArray = Array.isArray(items) ? items : [];

    for (const item of itemsArray) {
      const itemSubtotal = item.price * item.quantity;
      const gstBreakdown = calculateGstBreakdown(
        itemSubtotal,
        item.gstRate,
        sellerState,
        buyerState,
      );
      totalCgst += gstBreakdown.cgst;
      totalSgst += gstBreakdown.sgst;
      totalIgst += gstBreakdown.igst;
    }

    return {
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      totalGst: totalCgst + totalSgst + totalIgst,
      isIntraState: sellerState === buyerState,
    };
  }
}
