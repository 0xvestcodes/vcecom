import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { and, desc, eq, orders, payments, refunds } from "@vcecom/db";
import { RefundsApi } from "cashfree-pg-sdk-nodejs";
import { PinoLogger } from "nestjs-pino";
import Razorpay from "razorpay";
import { AuditLogService } from "../../../../common/audit/audit-log.service";
import { AppConfigService } from "../../../../common/config/app.config.service";
import {
  MAX_REFUND_AMOUNT_MULTIPLIER,
  MIN_REFUND_AMOUNT_INR,
} from "../../../../common/constants/orders.constants";
import { RefundResponseDto } from "../../../admin/dto/refund-response.dto";
import { DB_TOKEN } from "../../../database/database.module";
import type { Database } from "../../../database/db";
import { NotificationsService } from "../../../notifications/notifications.service";
import { NotificationType } from "../../../notifications/types/notification.types";
import { CashfreeConfigService } from "../../../payments/cashfree-config.service";
import { PayUConfigService } from "../../../payments/payu-config.service";
import { RazorpayConfigService } from "../../../payments/razorpay-config.service";
import { RefundReconciliationService } from "../../../returns/services/refund-reconciliation.service";
import { WalletService } from "../../../wallet/services/wallet.service";
import { TimelineEventType } from "../../dto/order-timeline.dto";
import { OrderTimelineService } from "../status/order-timeline.service";

@Injectable()
export class RefundsService implements OnModuleInit {
  private razorpay: Razorpay | null = null;
  private cashfreeConfig: {
    appId: string;
    secretKey: string;
    environment: "sandbox" | "production";
  } | null = null;
  private payuConfig: {
    merchantKey: string;
    merchantSalt: string;
    environment: "sandbox" | "production";
  } | null = null;

  constructor(
    private readonly logger: PinoLogger,
    private readonly razorpayConfigService: RazorpayConfigService,
    private readonly cashfreeConfigService: CashfreeConfigService,
    readonly _payuConfigService: PayUConfigService,
    private readonly appConfigService: AppConfigService,
    private readonly timelineService: OrderTimelineService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
    @Optional()
    @Inject(forwardRef(() => RefundReconciliationService))
    private readonly reconciliationService?: RefundReconciliationService,
    private readonly walletService?: WalletService,
  ) {}

  /**
   * Initialize payment gateways on module initialization
   * Reads configuration from AppConfigService
   */
  onModuleInit() {
    // Initialize Razorpay
    const razorpayConfig = this.appConfigService.getRazorpayConfig();
    if (razorpayConfig.keyId && razorpayConfig.keySecret) {
      this.razorpay = this.razorpayConfigService.initialize({
        keyId: razorpayConfig.keyId,
        keySecret: razorpayConfig.keySecret,
      });
    }

    // Initialize Cashfree
    const cashfreeEnvConfig = this.appConfigService.getCashfreeConfig();
    if (cashfreeEnvConfig.appId && cashfreeEnvConfig.secretKey) {
      this.cashfreeConfig = this.cashfreeConfigService.initialize({
        appId: cashfreeEnvConfig.appId,
        secretKey: cashfreeEnvConfig.secretKey,
        environment: cashfreeEnvConfig.environment,
        timeout: cashfreeEnvConfig.timeout,
      });
    }

    // Initialize PayU
    const payuEnvConfig = this.appConfigService.getPayUConfig();
    if (payuEnvConfig.merchantKey && payuEnvConfig.merchantSalt) {
      this.payuConfig = {
        merchantKey: payuEnvConfig.merchantKey,
        merchantSalt: payuEnvConfig.merchantSalt,
        environment: payuEnvConfig.environment,
      };
    }
  }

  /**
   * Get all refunds for an order
   * @param orderId - Order ID
   * @returns Array of refunds
   */
  async findByOrderId(orderId: string): Promise<RefundResponseDto[]> {
    // Verify order exists
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const refundsList = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, orderId))
      .orderBy(desc(refunds.createdAt));

    return refundsList;
  }

  /**
   * Create a refund for an order
   * @param orderId - Order ID
   * @param amount - Refund amount
   * @param reason - Reason for refund
   * @returns Created refund
   */
  async create(
    orderId: string,
    amount: number,
    reason: string,
    options?: { refundToWallet?: boolean },
  ): Promise<RefundResponseDto> {
    if (amount <= 0) {
      throw new BadRequestException("Refund amount must be greater than 0");
    }

    if (amount < MIN_REFUND_AMOUNT_INR) {
      throw new BadRequestException(
        `Refund amount must be at least ${MIN_REFUND_AMOUNT_INR} INR`,
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException("Refund reason is required");
    }

    // Get order
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Calculate total already refunded
    const existingRefunds = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, orderId));

    const totalRefunded = existingRefunds.reduce(
      (sum, refund) => sum + Number(refund.amount),
      0,
    );

    // Calculate refundable amount (exclude payment fee for partial refunds)
    // Payment fees are typically NOT refunded by payment gateways
    // Full refund: refund entire order total (includes fee)
    // Partial refund: exclude payment fee from refundable amount
    const paymentFeeInRupees = (order.paymentFee || 0) / 100;
    const isFullRefund = amount >= order.total - totalRefunded;
    const refundableAmount = isFullRefund
      ? order.total // Full refund includes fee
      : order.total - paymentFeeInRupees; // Partial refund excludes fee

    const maxRefundable = refundableAmount * MAX_REFUND_AMOUNT_MULTIPLIER;
    const remainingRefundable = maxRefundable - totalRefunded;

    if (amount > remainingRefundable) {
      const feeNote = isFullRefund
        ? ""
        : ` (Payment fee of ₹${paymentFeeInRupees.toFixed(2)} excluded from partial refund)`;
      throw new BadRequestException(
        `Refund amount exceeds remaining refundable amount of ₹${remainingRefundable.toFixed(2)}${feeNote}`,
      );
    }

    // Log refund calculation for audit
    this.logger.debug(
      {
        orderId,
        refundAmount: amount,
        orderTotal: order.total,
        paymentFee: paymentFeeInRupees,
        isFullRefund,
        refundableAmount,
        totalRefunded,
        remainingRefundable,
      },
      "Refund calculation - payment fee handling",
    );

    // Create refund record
    const [createdRefund] = await this.db
      .insert(refunds)
      .values({
        orderId,
        amount,
        reason: reason.trim(),
        status: "pending",
      })
      .returning();

    this.logger.info(
      {
        orderId,
        refundId: createdRefund.id,
        amount,
        reason,
      },
      "Refund created",
    );

    // Add timeline event
    await this.timelineService.addEvent(orderId, {
      type: TimelineEventType.REFUND_CREATED,
      title: "Refund Created",
      description: `Refund of ₹${amount} created. Reason: ${reason.trim()}`,
      actor: "admin",
      timestamp: createdRefund.createdAt,
      metadata: {
        refundId: createdRefund.id,
        amount,
        reason: reason.trim(),
        status: createdRefund.status,
      },
    });

    // Create notification for refund
    try {
      await this.notificationsService.createFromEvent({
        adminId: null, // Broadcast to all admins
        type: NotificationType.ORDER,
        title: "Refund Created",
        message: `Refund of ₹${amount.toFixed(2)} created for Order #${order.orderNumber || orderId}`,
        meta: {
          orderId,
          refundId: createdRefund.id,
          amount,
          reason: reason.trim(),
        },
      });
    } catch (error) {
      // Log but don't throw - notification failure shouldn't break refund creation
      this.logger.warn(
        {
          orderId,
          refundId: createdRefund.id,
          error,
        },
        "Failed to create refund notification",
      );
    }

    // Log audit event
    await this.auditLogService.logRefundCreation(
      createdRefund.id,
      orderId,
      amount,
      reason,
      null, // actorId not available in this context
      "system",
    );

    // If refunding to wallet, credit wallet instead of processing via payment gateway
    if (options?.refundToWallet && this.walletService) {
      try {
        await this.walletService.creditWallet(
          order.customerId,
          amount,
          `Refund for order ${order.orderNumber}: ${reason.trim()}`,
          {
            orderId,
            refundId: createdRefund.id,
          },
        );

        // Mark refund as completed since it's credited to wallet
        const [updatedRefund] = await this.db
          .update(refunds)
          .set({
            status: "completed",
            processedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(refunds.id, createdRefund.id))
          .returning();

        this.logger.info(
          {
            refundId: createdRefund.id,
            orderId,
            amount,
            customerId: order.customerId,
          },
          "Refund credited to customer wallet",
        );

        return updatedRefund;
      } catch (error) {
        this.logger.error(
          {
            refundId: createdRefund.id,
            orderId,
            error,
          },
          "Failed to credit refund to wallet",
        );
        // Continue with payment gateway refund as fallback
      }
    }

    // Process refund asynchronously if payment provider is available
    const paymentGateway = this.detectPaymentGateway(order);
    if (paymentGateway) {
      this.processRefund(createdRefund.id).catch((error) => {
        this.logger.error(
          {
            refundId: createdRefund.id,
            error,
          },
          "Failed to process refund",
        );
      });
    }

    return createdRefund;
  }

  /**
   * Process refund via payment provider
   * @param refundId - Refund ID
   * @returns Updated refund
   */
  async processRefund(refundId: string) {
    const [refund] = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!refund) {
      throw new NotFoundException(`Refund with ID ${refundId} not found`);
    }

    if (refund.status !== "pending") {
      throw new BadRequestException(
        `Refund is already ${refund.status}, cannot process again`,
      );
    }

    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, refund.orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Detect payment gateway
    const paymentGateway = this.detectPaymentGateway(order);
    if (!paymentGateway) {
      // Mark as failed if no payment provider
      await this.db
        .update(refunds)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refundId));

      return refund;
    }

    try {
      // Get payment ID from payments table
      const [payment] = await this.db
        .select()
        .from(payments)
        .where(
          and(eq(payments.orderId, order.id), eq(payments.status, "captured")),
        )
        .limit(1);

      if (!payment) {
        throw new NotFoundException("Payment not found for refund");
      }

      let providerRefundId: string;
      let refundAmount: number;

      // Process refund based on gateway
      switch (paymentGateway) {
        case "razorpay": {
          if (!payment.razorpayPaymentId || !this.razorpay) {
            throw new BadRequestException(
              "Razorpay payment ID not found or Razorpay not initialized",
            );
          }
          const razorpayRefund = await this.razorpay.payments.refund(
            payment.razorpayPaymentId,
            {
              amount: Math.round(refund.amount * 100), // Convert to paise
              notes: {
                reason: refund.reason,
                order_id: order.id,
              },
            },
          );
          providerRefundId = razorpayRefund.id;
          refundAmount = refund.amount;
          break;
        }

        case "cashfree": {
          if (!payment.cashfreePaymentId || !this.cashfreeConfig) {
            throw new BadRequestException(
              "Cashfree payment ID not found or Cashfree not initialized",
            );
          }
          const cashfreeRefund = await this.processCashfreeRefund(
            payment.cashfreePaymentId,
            order.cashfreeOrderId || order.id,
            refund.amount,
            refund.reason,
          );
          providerRefundId = cashfreeRefund.refundId;
          refundAmount = cashfreeRefund.amount;
          break;
        }

        case "payu": {
          if (!payment.payuPaymentId || !this.payuConfig) {
            throw new BadRequestException(
              "PayU payment ID not found or PayU not initialized",
            );
          }
          const payuRefund = await this.processPayURefund(
            payment.payuPaymentId,
            refund.amount,
            refund.reason,
            order.orderNumber,
          );
          providerRefundId = payuRefund.refundId;
          refundAmount = payuRefund.amount;
          break;
        }

        default:
          throw new BadRequestException(
            `Unsupported payment gateway: ${paymentGateway}`,
          );
      }

      // Update refund with provider refund ID
      const [updatedRefund] = await this.db
        .update(refunds)
        .set({
          status: "completed",
          providerRefundId,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refundId))
        .returning();

      // Create reconciliation record (if service is available)
      if (this.reconciliationService) {
        try {
          const reconciliation =
            await this.reconciliationService.createReconciliation(
              refundId,
              providerRefundId,
              paymentGateway,
              refund.amount,
            );

          // Update reconciliation with actual amount
          await this.reconciliationService.updateReconciliation(
            reconciliation.id,
            refundAmount,
          );
        } catch (error) {
          // Log but don't fail refund processing if reconciliation fails
          this.logger.warn(
            {
              refundId,
              error: error instanceof Error ? error.message : String(error),
            },
            "Failed to create reconciliation record",
          );
        }
      }

      // Add timeline event
      await this.timelineService.addEvent(refund.orderId, {
        type: TimelineEventType.REFUND_PROCESSED,
        title: "Refund Processed",
        description: `Refund of ₹${refundAmount} has been processed via ${paymentGateway}`,
        actor: "system",
        timestamp: updatedRefund.processedAt || new Date(),
        metadata: {
          refundId: updatedRefund.id,
          providerRefundId: updatedRefund.providerRefundId,
          gateway: paymentGateway,
        },
      });

      this.logger.info(
        {
          refundId,
          providerRefundId,
          gateway: paymentGateway,
        },
        "Refund processed successfully",
      );

      return updatedRefund;
    } catch (error) {
      // Mark refund as failed
      await this.db
        .update(refunds)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refundId));

      this.logger.error(
        {
          refundId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to process refund",
      );

      throw error;
    }
  }

  /**
   * Detect payment gateway from order
   */
  private detectPaymentGateway(
    order: typeof orders.$inferSelect,
  ): "razorpay" | "cashfree" | "payu" | null {
    if (order.razorpayOrderId) {
      return "razorpay";
    }
    if (order.cashfreeOrderId) {
      return "cashfree";
    }
    if (order.payuTxnId) {
      return "payu";
    }
    return null;
  }

  /**
   * Process Cashfree refund
   */
  private async processCashfreeRefund(
    paymentId: string,
    orderId: string,
    amount: number,
    reason: string,
  ): Promise<{ refundId: string; amount: number }> {
    if (!this.cashfreeConfig) {
      throw new BadRequestException("Cashfree is not initialized");
    }

    const refundsApi = new RefundsApi();

    // Create refund request
    const refundRequest = {
      refundAmount: amount,
      refundId: `refund_${Date.now()}`,
      refundNote: reason,
    };

    try {
      const response = await refundsApi.createrefund(
        process.env.CASHFREE_CLIENT_ID || "",
        process.env.CASHFREE_CLIENT_SECRET || "",
        orderId,
        undefined,
        undefined,
        undefined,
        undefined,
        refundRequest,
      );
      const responseData = response as {
        cfRefund?: { refundId?: string; refundAmount?: number };
      };
      const cfRefund = responseData.cfRefund || {};
      return {
        refundId: cfRefund.refundId || refundRequest.refundId,
        amount: cfRefund.refundAmount || amount,
      };
    } catch (error) {
      this.logger.error(
        {
          paymentId,
          amount,
          error: error instanceof Error ? error.message : String(error),
        },
        "Cashfree refund failed",
      );
      throw error;
    }
  }

  /**
   * Process PayU refund
   */
  private async processPayURefund(
    paymentId: string,
    amount: number,
    reason: string,
    orderNumber: string,
  ): Promise<{ refundId: string; amount: number }> {
    if (!this.payuConfig) {
      throw new BadRequestException("PayU is not initialized");
    }

    // PayU refund API implementation
    // Note: PayU refund API requires specific format and signature
    const _baseUrl =
      this.payuConfig.environment === "production"
        ? "https://secure.payu.in"
        : "https://test.payu.in";

    const refundId = `refund_${Date.now()}`;
    const refundAmount = Math.round(amount * 100); // Convert to paise

    // Create refund request hash
    const hashString = `${this.payuConfig.merchantKey}|${refundId}|${refundAmount}|${paymentId}|${this.payuConfig.merchantSalt}`;
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    // Make refund API call
    const _refundData = {
      command: "cancel_refund_transaction",
      merchant_key: this.payuConfig.merchantKey,
      payment_id: paymentId,
      refund_amount: refundAmount.toString(),
      refund_id: refundId,
      hash: hash,
    };

    try {
      // In a real implementation, you would make HTTP request to PayU API
      // For now, we'll simulate the response
      // TODO: Implement actual PayU refund API call
      this.logger.warn(
        {
          paymentId,
          refundId,
          amount,
        },
        "PayU refund API call not fully implemented - using simulated response",
      );

      return {
        refundId,
        amount,
      };
    } catch (error) {
      this.logger.error(
        {
          paymentId,
          amount,
          error: error instanceof Error ? error.message : String(error),
        },
        "PayU refund failed",
      );
      throw error;
    }
  }
}
