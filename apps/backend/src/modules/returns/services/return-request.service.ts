import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  eq,
  inArray,
  orderItems,
  orders,
  returnItems,
  returnRequests,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { AuditLogService } from "../../../common/audit/audit-log.service";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { NotificationsService } from "../../notifications/notifications.service";
import { NotificationType } from "../../notifications/types/notification.types";
import { TimelineEventType } from "../../orders/dto/order-timeline.dto";
import { OrderTimelineService } from "../../orders/services/status/order-timeline.service";
import { ReturnEligibilityService } from "./return-eligibility.service";
import { RmaGenerationService } from "./rma-generation.service";

export interface CreateReturnRequestDto {
  orderId: string;
  customerId: string;
  reason: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
    reason: string;
    condition: "new" | "damaged" | "defective" | "other";
  }>;
}

export interface ReturnRequestResponse {
  id: string;
  orderId: string;
  customerId: string;
  rmaNumber: string;
  status: string;
  reason: string;
  requestedAt: Date;
  items: Array<{
    id: string;
    orderItemId: string;
    quantity: number;
    reason: string;
    condition: string;
    refundAmount: number;
    status: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ReturnRequestService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly eligibilityService: ReturnEligibilityService,
    private readonly rmaGenerationService: RmaGenerationService,
    private readonly timelineService: OrderTimelineService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Create a return request
   * @param dto - Return request creation data
   * @returns Created return request
   */
  async create(dto: CreateReturnRequestDto): Promise<ReturnRequestResponse> {
    const { orderId, customerId, reason, items } = dto;

    // Validate order exists and belongs to customer
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Check if order is delivered
    if (order.status !== "delivered") {
      throw new BadRequestException(
        "Order must be delivered to create a return request",
      );
    }

    // Check eligibility
    const eligibility = await this.eligibilityService.checkEligibility({
      orderId,
      customerId,
      returnReason: reason,
      orderItemIds: items.map((item) => item.orderItemId),
    });

    if (!eligibility.eligible) {
      throw new BadRequestException(
        `Return request not eligible: ${eligibility.reasons.join(", ")}`,
      );
    }

    // Validate order items exist and belong to order
    const orderItemIds = items.map((item) => item.orderItemId);
    const orderItemsList = await this.db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, orderId),
          inArray(orderItems.id, orderItemIds),
        ),
      );

    if (orderItemsList.length !== items.length) {
      throw new BadRequestException("Some order items not found");
    }

    // Validate quantities
    for (const item of items) {
      const orderItem = orderItemsList.find((oi) => oi.id === item.orderItemId);
      if (!orderItem) {
        throw new BadRequestException(
          `Order item ${item.orderItemId} not found`,
        );
      }
      if (item.quantity > orderItem.quantity) {
        throw new BadRequestException(
          `Return quantity (${item.quantity}) exceeds ordered quantity (${orderItem.quantity}) for item ${item.orderItemId}`,
        );
      }
    }

    // Check for existing pending return requests for same order items
    const existingReturns = await this.db
      .select()
      .from(returnRequests)
      .where(
        and(
          eq(returnRequests.orderId, orderId),
          eq(returnRequests.status, "pending"),
        ),
      );

    if (existingReturns.length > 0) {
      throw new BadRequestException(
        "A pending return request already exists for this order",
      );
    }

    // Generate RMA number
    const rmaNumber = await this.rmaGenerationService.generateRmaNumber();

    // Calculate refund amounts for each item
    const returnItemsData = await Promise.all(
      items.map(async (item) => {
        const orderItem = orderItemsList.find(
          (oi) => oi.id === item.orderItemId,
        );
        if (!orderItem) {
          throw new Error(
            `Order item not found for orderItemId: ${item.orderItemId}`,
          );
        }

        // Calculate proportional refund amount
        // For partial returns, calculate based on item price proportion
        const itemTotal = orderItem.price * orderItem.quantity;
        const returnProportion = item.quantity / orderItem.quantity;
        const refundAmount = itemTotal * returnProportion;

        return {
          returnRequestId: "", // Will be set after return request creation
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          reason: item.reason,
          condition: item.condition,
          refundAmount,
          status: "pending" as const,
        };
      }),
    );

    // Create return request
    const [createdReturn] = await this.db
      .insert(returnRequests)
      .values({
        orderId,
        customerId,
        rmaNumber,
        status: "pending",
        reason,
        requestedAt: new Date(),
      })
      .returning();

    // Create return items
    const createdReturnItems = await Promise.all(
      returnItemsData.map((itemData) =>
        this.db
          .insert(returnItems)
          .values({
            ...itemData,
            returnRequestId: createdReturn.id,
          })
          .returning(),
      ),
    );

    // Add timeline event
    await this.timelineService.addEvent(orderId, {
      type: TimelineEventType.RETURN_REQUEST_CREATED,
      title: "Return Request Created",
      description: `Return request ${rmaNumber} created. Reason: ${reason}`,
      actor: "customer",
      timestamp: createdReturn.requestedAt,
      metadata: {
        returnRequestId: createdReturn.id,
        rmaNumber,
        reason,
        itemCount: items.length,
      },
    });

    // Create notification
    try {
      await this.notificationsService.createFromEvent({
        adminId: null, // Broadcast to all admins
        type: NotificationType.ORDER,
        title: "New Return Request",
        message: `Return request ${rmaNumber} created for Order #${order.orderNumber}`,
        meta: {
          orderId,
          returnRequestId: createdReturn.id,
          rmaNumber,
        },
      });
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "createReturnRequest", error, {
          returnRequestId: createdReturn.id,
        }),
        "Failed to create return request notification",
      );
    }

    // Log audit event
    await this.auditLogService.log({
      entityType: "return_request",
      entityId: createdReturn.id,
      action: "CREATE",
      actorId: customerId,
      actorType: "customer",
      metadata: {
        orderId,
        rmaNumber,
        reason,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.info(
      createLogContext(this.contextService, "createReturnRequest", {
        returnRequestId: createdReturn.id,
        rmaNumber,
        orderId,
        customerId,
      }),
      "Return request created",
    );

    return {
      id: createdReturn.id,
      orderId: createdReturn.orderId,
      customerId: createdReturn.customerId,
      rmaNumber: createdReturn.rmaNumber,
      status: createdReturn.status,
      reason: createdReturn.reason,
      requestedAt: createdReturn.requestedAt,
      items: createdReturnItems.map(([item]) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        reason: item.reason,
        condition: item.condition,
        refundAmount: Number(item.refundAmount),
        status: item.status,
      })),
      createdAt: createdReturn.createdAt,
      updatedAt: createdReturn.updatedAt,
    };
  }

  /**
   * Get return request by ID
   */
  async findOne(
    returnRequestId: string,
    customerId?: string,
  ): Promise<ReturnRequestResponse | null> {
    const whereConditions = [eq(returnRequests.id, returnRequestId)];
    if (customerId) {
      whereConditions.push(eq(returnRequests.customerId, customerId));
    }

    const [returnRequest] = await this.db
      .select()
      .from(returnRequests)
      .where(and(...whereConditions))
      .limit(1);

    if (!returnRequest) {
      return null;
    }

    const returnItemsList = await this.db
      .select()
      .from(returnItems)
      .where(eq(returnItems.returnRequestId, returnRequest.id));

    return {
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      customerId: returnRequest.customerId,
      rmaNumber: returnRequest.rmaNumber,
      status: returnRequest.status,
      reason: returnRequest.reason,
      requestedAt: returnRequest.requestedAt,
      items: returnItemsList.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        reason: item.reason,
        condition: item.condition,
        refundAmount: Number(item.refundAmount),
        status: item.status,
      })),
      createdAt: returnRequest.createdAt,
      updatedAt: returnRequest.updatedAt,
    };
  }

  /**
   * Get return requests for an order
   */
  async findByOrderId(
    orderId: string,
    customerId?: string,
  ): Promise<ReturnRequestResponse[]> {
    const whereConditions = [eq(returnRequests.orderId, orderId)];
    if (customerId) {
      whereConditions.push(eq(returnRequests.customerId, customerId));
    }

    const returnRequestsList = await this.db
      .select()
      .from(returnRequests)
      .where(and(...whereConditions));

    const returnRequestIds = returnRequestsList.map((rr) => rr.id);
    const allReturnItems =
      returnRequestIds.length > 0
        ? await this.db
            .select()
            .from(returnItems)
            .where(inArray(returnItems.returnRequestId, returnRequestIds))
        : [];

    const returnItemsMap = new Map<
      string,
      (typeof returnItems.$inferSelect)[]
    >();
    for (const item of allReturnItems) {
      const items = returnItemsMap.get(item.returnRequestId) || [];
      items.push(item);
      returnItemsMap.set(item.returnRequestId, items);
    }

    return returnRequestsList.map((rr) => ({
      id: rr.id,
      orderId: rr.orderId,
      customerId: rr.customerId,
      rmaNumber: rr.rmaNumber,
      status: rr.status,
      reason: rr.reason,
      requestedAt: rr.requestedAt,
      items: (returnItemsMap.get(rr.id) || []).map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        reason: item.reason,
        condition: item.condition,
        refundAmount: Number(item.refundAmount),
        status: item.status,
      })),
      createdAt: rr.createdAt,
      updatedAt: rr.updatedAt,
    }));
  }
}
