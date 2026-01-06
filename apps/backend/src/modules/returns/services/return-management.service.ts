import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq, orderItems, returnItems, returnRequests } from "@vcecom/db";
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
import { RefundsService } from "../../orders/services/payment/refunds.service";
import { OrderTimelineService } from "../../orders/services/status/order-timeline.service";
import { InventoryStore } from "../../redis-store/stores/inventory-store";
import {
  ReturnRequestResponse,
  ReturnRequestService,
} from "./return-request.service";

export interface ApproveReturnDto {
  returnAddressId?: string;
  notes?: string;
}

export interface RejectReturnDto {
  reason: string;
}

export interface UpdateReturnStatusDto {
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "in_transit"
    | "received"
    | "processing_refund"
    | "completed"
    | "cancelled";
  trackingNumber?: string;
  notes?: string;
}

@Injectable()
export class ReturnManagementService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly returnRequestService: ReturnRequestService,
    private readonly refundsService: RefundsService,
    private readonly timelineService: OrderTimelineService,
    private readonly notificationsService: NotificationsService,
    private readonly inventoryStore: InventoryStore,
    private readonly auditLogService: AuditLogService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Approve a return request
   */
  async approveReturn(
    returnRequestId: string,
    adminId: string,
    dto: ApproveReturnDto,
  ): Promise<ReturnRequestResponse> {
    const [returnRequest] = await this.db
      .select()
      .from(returnRequests)
      .where(eq(returnRequests.id, returnRequestId))
      .limit(1);

    if (!returnRequest) {
      throw new NotFoundException("Return request not found");
    }

    if (returnRequest.status !== "pending") {
      throw new BadRequestException(
        `Cannot approve return request with status ${returnRequest.status}`,
      );
    }

    // Update return request status
    const [updatedReturn] = await this.db
      .update(returnRequests)
      .set({
        status: "approved",
        approvedAt: new Date(),
        approvedBy: adminId,
        returnAddressId: dto.returnAddressId || null,
        updatedAt: new Date(),
      })
      .where(eq(returnRequests.id, returnRequestId))
      .returning();

    // Add timeline event
    await this.timelineService.addEvent(returnRequest.orderId, {
      type: TimelineEventType.RETURN_REQUEST_APPROVED,
      title: "Return Request Approved",
      description: `Return request ${returnRequest.rmaNumber} has been approved`,
      actor: "admin",
      actorId: adminId,
      timestamp: updatedReturn.approvedAt || new Date(),
      metadata: {
        returnRequestId: updatedReturn.id,
        rmaNumber: updatedReturn.rmaNumber,
        returnAddressId: dto.returnAddressId,
      },
    });

    // Notify customer
    try {
      await this.notificationsService.createFromEvent({
        adminId: null,
        type: NotificationType.ORDER,
        title: "Return Request Approved",
        message: `Your return request ${returnRequest.rmaNumber} has been approved`,
        meta: {
          orderId: returnRequest.orderId,
          returnRequestId: updatedReturn.id,
          rmaNumber: updatedReturn.rmaNumber,
        },
      });
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "approveReturn", error, {
          returnRequestId,
        }),
        "Failed to send approval notification",
      );
    }

    // Log audit
    await this.auditLogService.log({
      entityType: "return_request",
      entityId: returnRequestId,
      action: "APPROVE",
      actorId: adminId,
      actorType: "admin",
      metadata: {
        orderId: returnRequest.orderId,
        rmaNumber: returnRequest.rmaNumber,
        timestamp: new Date().toISOString(),
      },
    });

    return (await this.returnRequestService.findOne(
      returnRequestId,
    )) as ReturnRequestResponse;
  }

  /**
   * Reject a return request
   */
  async rejectReturn(
    returnRequestId: string,
    adminId: string,
    dto: RejectReturnDto,
  ): Promise<ReturnRequestResponse> {
    const [returnRequest] = await this.db
      .select()
      .from(returnRequests)
      .where(eq(returnRequests.id, returnRequestId))
      .limit(1);

    if (!returnRequest) {
      throw new NotFoundException("Return request not found");
    }

    if (returnRequest.status !== "pending") {
      throw new BadRequestException(
        `Cannot reject return request with status ${returnRequest.status}`,
      );
    }

    // Update return request status
    const [updatedReturn] = await this.db
      .update(returnRequests)
      .set({
        status: "rejected",
        rejectionReason: dto.reason,
        updatedAt: new Date(),
      })
      .where(eq(returnRequests.id, returnRequestId))
      .returning();

    // Add timeline event
    await this.timelineService.addEvent(returnRequest.orderId, {
      type: TimelineEventType.RETURN_REQUEST_REJECTED,
      title: "Return Request Rejected",
      description: `Return request ${returnRequest.rmaNumber} has been rejected. Reason: ${dto.reason}`,
      actor: "admin",
      actorId: adminId,
      timestamp: new Date(),
      metadata: {
        returnRequestId: updatedReturn.id,
        rmaNumber: updatedReturn.rmaNumber,
        rejectionReason: dto.reason,
      },
    });

    // Notify customer
    try {
      await this.notificationsService.createFromEvent({
        adminId: null,
        type: NotificationType.ORDER,
        title: "Return Request Rejected",
        message: `Your return request ${returnRequest.rmaNumber} has been rejected. Reason: ${dto.reason}`,
        meta: {
          orderId: returnRequest.orderId,
          returnRequestId: updatedReturn.id,
          rmaNumber: updatedReturn.rmaNumber,
        },
      });
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "rejectReturn", error, {
          returnRequestId,
        }),
        "Failed to send rejection notification",
      );
    }

    // Log audit
    await this.auditLogService.log({
      entityType: "return_request",
      entityId: returnRequestId,
      action: "REJECT",
      actorId: adminId,
      actorType: "admin",
      metadata: {
        orderId: returnRequest.orderId,
        rmaNumber: returnRequest.rmaNumber,
        reason: dto.reason,
        timestamp: new Date().toISOString(),
      },
    });

    return (await this.returnRequestService.findOne(
      returnRequestId,
    )) as ReturnRequestResponse;
  }

  /**
   * Update return request status
   */
  async updateStatus(
    returnRequestId: string,
    adminId: string,
    dto: UpdateReturnStatusDto,
  ): Promise<ReturnRequestResponse> {
    const [returnRequest] = await this.db
      .select()
      .from(returnRequests)
      .where(eq(returnRequests.id, returnRequestId))
      .limit(1);

    if (!returnRequest) {
      throw new NotFoundException("Return request not found");
    }

    // Validate status transition
    this.validateStatusTransition(returnRequest.status, dto.status);

    const updateData: Partial<typeof returnRequests.$inferInsert> = {
      status: dto.status,
      updatedAt: new Date(),
    };

    if (dto.status === "in_transit" && dto.trackingNumber) {
      updateData.trackingNumber = dto.trackingNumber;
    }

    if (dto.status === "received") {
      updateData.receivedAt = new Date();
    }

    if (dto.status === "completed") {
      updateData.completedAt = new Date();
    }

    // Update return request
    const [updatedReturn] = await this.db
      .update(returnRequests)
      .set(updateData)
      .where(eq(returnRequests.id, returnRequestId))
      .returning();

    // Handle status-specific actions
    if (dto.status === "received") {
      // Restock inventory
      await this.restockInventory(returnRequestId);
    }

    if (dto.status === "processing_refund") {
      // Initiate refund
      await this.processRefund(returnRequestId);
    }

    // Add timeline event
    const eventType = this.getTimelineEventType(dto.status);
    await this.timelineService.addEvent(returnRequest.orderId, {
      type: eventType,
      title: `Return Request ${dto.status}`,
      description: `Return request ${returnRequest.rmaNumber} status updated to ${dto.status}`,
      actor: "admin",
      actorId: adminId,
      timestamp: new Date(),
      metadata: {
        returnRequestId: updatedReturn.id,
        rmaNumber: updatedReturn.rmaNumber,
        previousStatus: returnRequest.status,
        newStatus: dto.status,
        trackingNumber: dto.trackingNumber,
      },
    });

    // Log audit
    await this.auditLogService.log({
      entityType: "return_request",
      entityId: returnRequestId,
      action: "STATUS_UPDATE",
      actorId: adminId,
      actorType: "admin",
      changes: {
        oldStatus: returnRequest.status,
        newStatus: dto.status,
      },
      metadata: {
        orderId: returnRequest.orderId,
        rmaNumber: returnRequest.rmaNumber,
        timestamp: new Date().toISOString(),
      },
    });

    return (await this.returnRequestService.findOne(
      returnRequestId,
    )) as ReturnRequestResponse;
  }

  /**
   * Process refund for return request
   */
  private async processRefund(returnRequestId: string): Promise<void> {
    const returnRequest =
      await this.returnRequestService.findOne(returnRequestId);

    if (!returnRequest) {
      throw new NotFoundException("Return request not found");
    }

    // Calculate total refund amount from return items
    const totalRefundAmount = returnRequest.items.reduce(
      (sum, item) => sum + item.refundAmount,
      0,
    );

    if (totalRefundAmount <= 0) {
      throw new BadRequestException("Refund amount must be greater than 0");
    }

    // Create refund
    await this.refundsService.create(
      returnRequest.orderId,
      totalRefundAmount,
      `Return request ${returnRequest.rmaNumber}: ${returnRequest.reason}`,
    );

    this.logger.info(
      createLogContext(this.contextService, "processRefund", {
        returnRequestId,
        orderId: returnRequest.orderId,
        refundAmount: totalRefundAmount,
      }),
      "Refund processed for return request",
    );
  }

  /**
   * Restock inventory for returned items
   */
  private async restockInventory(returnRequestId: string): Promise<void> {
    const returnRequest =
      await this.returnRequestService.findOne(returnRequestId);

    if (!returnRequest) {
      throw new NotFoundException("Return request not found");
    }

    // Get return items with order item details
    const returnItemsList = await this.db
      .select({
        returnItem: returnItems,
        orderItem: orderItems,
      })
      .from(returnItems)
      .innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
      .where(eq(returnItems.returnRequestId, returnRequestId));

    // Restock each item
    for (const { returnItem, orderItem } of returnItemsList) {
      try {
        await this.inventoryStore.incrementInventory(
          orderItem.productVariantId,
          returnItem.quantity,
        );

        this.logger.debug(
          createLogContext(this.contextService, "restockInventory", {
            returnRequestId,
            productVariantId: orderItem.productVariantId,
            quantity: returnItem.quantity,
          }),
          "Inventory restocked for returned item",
        );
      } catch (error) {
        this.logger.error(
          createErrorContext(this.contextService, "restockInventory", error, {
            returnRequestId,
            productVariantId: orderItem.productVariantId,
          }),
          "Failed to restock inventory",
        );
      }
    }
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: string,
    newStatus: string,
  ): void {
    const validTransitions: Record<string, string[]> = {
      pending: ["approved", "rejected", "cancelled"],
      approved: ["in_transit", "cancelled"],
      rejected: [], // Cannot transition from rejected
      in_transit: ["received", "cancelled"],
      received: ["processing_refund"],
      processing_refund: ["completed"],
      completed: [], // Cannot transition from completed
      cancelled: [], // Cannot transition from cancelled
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Get timeline event type for status
   */
  private getTimelineEventType(status: string): TimelineEventType {
    switch (status) {
      case "approved":
        return TimelineEventType.RETURN_REQUEST_APPROVED;
      case "rejected":
        return TimelineEventType.RETURN_REQUEST_REJECTED;
      case "in_transit":
        return TimelineEventType.RETURN_IN_TRANSIT;
      case "received":
        return TimelineEventType.RETURN_RECEIVED;
      case "completed":
        return TimelineEventType.RETURN_COMPLETED;
      default:
        return TimelineEventType.STATUS_CHANGED;
    }
  }
}
