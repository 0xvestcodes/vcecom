import { Inject, Injectable } from "@nestjs/common";
import {
  paymentFeeAuditEventTypeEnum,
  paymentFeeAuditLogs,
  paymentFeeAuditSeverityEnum,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { PaymentFeeBreakdownDto } from "../dto/payment-charge.dto";

export enum PaymentFeeAuditEventType {
  PAYMENT_FEE_APPLIED = "PAYMENT_FEE_APPLIED",
  PAYMENT_FEE_OVERRIDDEN = "PAYMENT_FEE_OVERRIDDEN",
  PAYMENT_METHOD_RESTRICTED = "PAYMENT_METHOD_RESTRICTED",
  PAYMENT_METHOD_NOT_AVAILABLE = "PAYMENT_METHOD_NOT_AVAILABLE",
  PAYMENT_FEE_CONFIGURATION_CHANGED = "PAYMENT_FEE_CONFIGURATION_CHANGED",
}

export enum PaymentFeeAuditSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
}

export interface PaymentFeeAuditLogEntry {
  event: PaymentFeeAuditEventType;
  severity?: PaymentFeeAuditSeverity;
  orderId?: string;
  checkoutId?: string;
  paymentIntentId?: string;
  paymentMethod: string;
  feeAmount?: number; // in paise
  feeBreakdown?: PaymentFeeBreakdownDto;
  reason?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PaymentFeeAuditService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Log payment fee audit event (async, non-blocking)
   */
  async logEvent(entry: PaymentFeeAuditLogEntry): Promise<void> {
    try {
      await this.db.insert(paymentFeeAuditLogs).values({
        timestamp: new Date(),
        event:
          entry.event as (typeof paymentFeeAuditEventTypeEnum.enumValues)[number],
        severity: (entry.severity ||
          PaymentFeeAuditSeverity.INFO) as (typeof paymentFeeAuditSeverityEnum.enumValues)[number],
        orderId: entry.orderId,
        checkoutId: entry.checkoutId,
        paymentIntentId: entry.paymentIntentId,
        paymentMethod: entry.paymentMethod,
        feeAmount: entry.feeAmount,
        feeBreakdown: entry.feeBreakdown as unknown,
        reason: entry.reason,
        metadata: entry.metadata as unknown,
      });
    } catch (error) {
      // Log error but don't throw - audit logging should never break core operations
      this.logger.error(
        createErrorContext(this.contextService, "logEvent", error, {
          event: entry.event,
        }),
        "Failed to log payment fee audit event",
      );
    }
  }

  /**
   * Log payment fee application
   */
  async logFeeApplied(
    checkoutId: string,
    paymentMethod: string,
    feeAmount: number,
    feeBreakdown: PaymentFeeBreakdownDto,
    paymentIntentId?: string,
  ): Promise<void> {
    await this.logEvent({
      event: PaymentFeeAuditEventType.PAYMENT_FEE_APPLIED,
      severity: PaymentFeeAuditSeverity.INFO,
      checkoutId,
      paymentIntentId,
      paymentMethod,
      feeAmount,
      feeBreakdown,
    });
  }

  /**
   * Log payment method restriction
   */
  async logMethodRestricted(
    checkoutId: string,
    paymentMethod: string,
    reason: string,
    cartTotal?: number,
  ): Promise<void> {
    await this.logEvent({
      event: PaymentFeeAuditEventType.PAYMENT_METHOD_RESTRICTED,
      severity: PaymentFeeAuditSeverity.WARNING,
      checkoutId,
      paymentMethod,
      reason,
      metadata: {
        cartTotal,
      },
    });
  }

  /**
   * Log payment method unavailability
   */
  async logMethodNotAvailable(
    checkoutId: string,
    paymentMethod: string,
    reason: string,
  ): Promise<void> {
    await this.logEvent({
      event: PaymentFeeAuditEventType.PAYMENT_METHOD_NOT_AVAILABLE,
      severity: PaymentFeeAuditSeverity.INFO,
      checkoutId,
      paymentMethod,
      reason,
    });
  }

  /**
   * Log payment fee configuration change
   */
  async logConfigurationChanged(
    paymentMethod: string,
    changes: Record<string, unknown>,
    adminId?: string,
  ): Promise<void> {
    await this.logEvent({
      event: PaymentFeeAuditEventType.PAYMENT_FEE_CONFIGURATION_CHANGED,
      severity: PaymentFeeAuditSeverity.WARNING,
      paymentMethod,
      metadata: {
        changes,
        adminId,
      },
    });
  }
}
