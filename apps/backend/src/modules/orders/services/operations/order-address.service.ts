import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { addresses, eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { MarkOrderPaidResponseDto } from "../../../admin/dto/mark-order-paid.dto";
import { DB_TOKEN } from "../../../database/database.module";
import type { Database } from "../../../database/db";
import { OrderResponseBuilderService } from "../query/order-response-builder.service";
import { TimelineEventType } from "../../dto/order-timeline.dto";
import { OrderTimelineService } from "../status/order-timeline.service";

interface AddressUpdate {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  district?: string;
}

@Injectable()
export class OrderAddressService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly timelineService: OrderTimelineService,
    private readonly responseBuilderService: OrderResponseBuilderService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Update order address
   * @param orderId - Order ID
   * @param addressType - Type of address to update (shipping or billing)
   * @param addressData - Address data to update
   * @param adminId - Admin user ID who made the update
   * @returns Updated order
   */
  async updateAddress(
    orderId: string,
    addressType: "shipping" | "billing",
    addressData: AddressUpdate,
    adminId: string,
  ): Promise<MarkOrderPaidResponseDto> {
    // Get order
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Validate required fields
    const requiredFields = ["street", "city", "state", "pincode", "country"];
    for (const field of requiredFields) {
      if (!addressData[field as keyof AddressUpdate]) {
        throw new BadRequestException(`${field} is required`);
      }
    }

    // Validate PIN code format (6 digits)
    if (addressData.pincode && !/^\d{6}$/.test(addressData.pincode)) {
      throw new BadRequestException("PIN code must be exactly 6 digits");
    }

    // Get the address ID to update
    const addressId =
      addressType === "shipping"
        ? order.shippingAddressId
        : order.billingAddressId;

    // Update address
    const [updatedAddress] = await this.db
      .update(addresses)
      .set({
        street: addressData.street,
        city: addressData.city,
        state: addressData.state,
        pincode: addressData.pincode,
        country: addressData.country,
        district: addressData.district || null,
        updatedAt: new Date(),
      })
      .where(eq(addresses.id, addressId))
      .returning();

    if (!updatedAddress) {
      throw new NotFoundException(`Address not found`);
    }

    // Add timeline event
    await this.timelineService.addEvent(orderId, {
      type: TimelineEventType.ADDRESS_UPDATED,
      title: `${addressType === "shipping" ? "Shipping" : "Billing"} Address Updated`,
      description: `Order ${addressType} address was updated`,
      actor: "admin",
      actorId: adminId,
      timestamp: new Date(),
      metadata: {
        addressType,
        addressId: updatedAddress.id,
      },
    });

    // Fetch updated order
    const [updatedOrder] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!updatedOrder) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Get order items
    const orderItemsList = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Calculate GST breakdown
    const gstBreakdown =
      await this.responseBuilderService.calculateGstBreakdownFromOrderItems(
        orderId,
        updatedOrder.shippingAddressId,
      );

    this.logger.info(
      {
        orderId,
        addressType,
        addressId,
        adminId,
      },
      "Order address updated",
    );

    return {
      ...updatedOrder,
      gstBreakdown,
      items: orderItemsList,
      paymentFeeBreakdown:
        (updatedOrder.paymentFeeBreakdown as {
          method: string;
          chargeType: string;
          calculatedFee: number;
          flatAmount?: number;
          percentage?: number;
          mixMin?: number;
          mixCap?: number;
        } | null) || null,
      discountCode: updatedOrder.discountCode ?? undefined,
      discountAmount: updatedOrder.discountAmount ?? undefined,
    };
  }
}
