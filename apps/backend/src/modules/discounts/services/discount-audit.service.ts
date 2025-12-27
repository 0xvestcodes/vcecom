import { Inject, Injectable } from "@nestjs/common";
import {
  discountAuditEventTypeEnum,
  discountAuditLogs,
  discountAuditSeverityEnum,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  AuditEventType,
  DiscountAuditLogEntry,
  DriftSeverity,
} from "../audit/discount-audit.types";
import { DiscountResponseDto } from "../dto/discount-response.dto";
import { DISCOUNT_ENGINE_VERSION } from "../engine/discount-engine.constants";
import {
  DiscountEngineResult,
  DiscountSnapshot,
} from "../engine/discount-engine.types";
import { computeRuleHash } from "../engine/discount-hash.utils";

@Injectable()
export class DiscountAuditService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Log discount audit event (async, non-blocking)
   */
  async logEvent(entry: DiscountAuditLogEntry): Promise<void> {
    try {
      await this.db.insert(discountAuditLogs).values({
        timestamp: new Date(),
        event:
          entry.event as (typeof discountAuditEventTypeEnum.enumValues)[number],
        cartId: entry.cartId,
        checkoutId: entry.checkoutId,
        orderId: entry.orderId,
        paymentIntentId: entry.paymentIntentId,
        snapshotVersion: entry.snapshotVersion,
        ruleHash: entry.ruleHash,
        engineVersion: entry.engineVersion,
        computedSubtotal: entry.computedSubtotal,
        computedTotal: entry.computedTotal,
        snapshotTotal: entry.snapshotTotal,
        paymentAmount: entry.paymentAmount,
        appliedDiscountIds: entry.appliedDiscountIds,
        driftDetails: entry.driftDetails,
        severity: (entry.severity ||
          DriftSeverity.INFO) as (typeof discountAuditSeverityEnum.enumValues)[number],
        metadata: entry.metadata,
      });
    } catch (error) {
      // Log error but don't throw - audit logging should never break core operations
      this.logger.error(
        createErrorContext(this.contextService, "logEvent", error, {
          event: entry.event,
        }),
        "Failed to log discount audit event",
      );
    }
  }

  /**
   * Log discount engine run
   */
  async logEngineRun(
    cartId: string,
    engineResult: DiscountEngineResult,
    appliedDiscounts: DiscountResponseDto[],
  ): Promise<void> {
    await this.logEvent({
      event: AuditEventType.DISCOUNT_ENGINE_RUN,
      cartId,
      computedSubtotal: engineResult.subtotal,
      computedTotal: engineResult.total,
      appliedDiscountIds: engineResult.appliedDiscountIds,
      engineVersion: DISCOUNT_ENGINE_VERSION,
      ruleHash: computeRuleHash(appliedDiscounts),
    });
  }

  /**
   * Log snapshot creation
   */
  async logSnapshotCreated(
    checkoutId: string,
    snapshot: DiscountSnapshot,
  ): Promise<void> {
    await this.logEvent({
      event: AuditEventType.DISCOUNT_SNAPSHOT_CREATED,
      checkoutId,
      snapshotVersion: snapshot.computedAt,
      ruleHash: snapshot.ruleHash,
      engineVersion: snapshot.engineVersion,
      snapshotTotal: snapshot.total,
      appliedDiscountIds: snapshot.appliedDiscountIds,
    });
  }

  /**
   * Log snapshot usage for order creation
   */
  async logSnapshotUsed(
    checkoutId: string,
    orderId: string,
    snapshot: DiscountSnapshot,
  ): Promise<void> {
    await this.logEvent({
      event: AuditEventType.DISCOUNT_SNAPSHOT_USED,
      checkoutId,
      orderId,
      snapshotVersion: snapshot.computedAt,
      ruleHash: snapshot.ruleHash,
      engineVersion: snapshot.engineVersion,
      snapshotTotal: snapshot.total,
      appliedDiscountIds: snapshot.appliedDiscountIds,
    });
  }

  /**
   * Log drift detection
   */
  async logDrift(
    entry: DiscountAuditLogEntry & {
      driftDetails: {
        reason: string;
        // biome-ignore lint/suspicious/noExplicitAny: Flexible expected value type
        expected: any;
        // biome-ignore lint/suspicious/noExplicitAny: Flexible actual value type
        actual: any;
        mismatchType: string;
      };
      severity: DriftSeverity;
    },
  ): Promise<void> {
    await this.logEvent({
      ...entry,
      event: AuditEventType.DRIFT_DETECTED,
    });
  }
}
