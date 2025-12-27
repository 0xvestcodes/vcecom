import { Inject, Injectable } from "@nestjs/common";
import {
  pricingAuditEventTypeEnum,
  pricingAuditLogs,
  pricingAuditSeverityEnum,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  PricingAuditEventType,
  PricingAuditLogEntry,
  PricingDriftSeverity,
} from "../audit/pricing-audit.types";
import { PRICING_ENGINE_VERSION } from "../engine/pricing-engine.constants";
import {
  PricingEngineResult,
  PricingSnapshot,
} from "../engine/pricing-engine.types";

@Injectable()
export class PricingAuditService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Log pricing audit event (async, non-blocking)
   */
  async logEvent(entry: PricingAuditLogEntry): Promise<void> {
    try {
      await this.db.insert(pricingAuditLogs).values({
        timestamp: new Date(),
        event:
          entry.event as (typeof pricingAuditEventTypeEnum.enumValues)[number],
        variantId: entry.variantId,
        orderId: entry.orderId,
        checkoutId: entry.checkoutId,
        priceListId: entry.priceListId,
        customerGroupId: entry.customerGroupId,
        basePrice: entry.basePrice,
        effectivePrice: entry.effectivePrice,
        snapshotPrice: entry.snapshotPrice,
        paymentAmount: entry.paymentAmount,
        rulesetVersion: entry.rulesetVersion,
        ruleHash: entry.ruleHash,
        engineVersion: entry.engineVersion,
        driftDetails: entry.driftDetails,
        severity: (entry.severity ||
          PricingDriftSeverity.INFO) as (typeof pricingAuditSeverityEnum.enumValues)[number],
        metadata: entry.metadata,
      });
    } catch (error) {
      // Log error but don't throw - audit logging should never break core operations
      this.logger.error(
        createErrorContext(this.contextService, "logEvent", error, {
          event: entry.event,
        }),
        "Failed to log pricing audit event",
      );
    }
  }

  /**
   * Log pricing engine run
   */
  async logEngineRun(
    checkoutId: string,
    engineResult: PricingEngineResult,
    rulesetVersion: number,
  ): Promise<void> {
    await this.logEvent({
      event: PricingAuditEventType.PRICING_ENGINE_RUN,
      checkoutId,
      basePrice: engineResult.totalBasePrice,
      effectivePrice: engineResult.totalEffectivePrice,
      rulesetVersion: rulesetVersion.toString(),
      engineVersion: PRICING_ENGINE_VERSION,
    });
  }

  /**
   * Log snapshot creation
   */
  async logSnapshotCreated(
    checkoutId: string,
    snapshot: PricingSnapshot,
  ): Promise<void> {
    await this.logEvent({
      event: PricingAuditEventType.PRICING_SNAPSHOT_CREATED,
      checkoutId,
      rulesetVersion: snapshot.rulesetVersion.toString(),
      ruleHash: snapshot.ruleHash,
      engineVersion: snapshot.engineVersion,
      snapshotPrice: snapshot.totalEffectivePrice,
      basePrice: snapshot.totalBasePrice,
    });
  }

  /**
   * Log snapshot usage for order creation
   */
  async logSnapshotUsed(
    checkoutId: string,
    orderId: string,
    snapshot: PricingSnapshot,
  ): Promise<void> {
    await this.logEvent({
      event: PricingAuditEventType.PRICING_SNAPSHOT_USED,
      checkoutId,
      orderId,
      rulesetVersion: snapshot.rulesetVersion.toString(),
      ruleHash: snapshot.ruleHash,
      engineVersion: snapshot.engineVersion,
      snapshotPrice: snapshot.totalEffectivePrice,
      basePrice: snapshot.totalBasePrice,
    });
  }

  /**
   * Log drift detection
   */
  async logDrift(
    entry: PricingAuditLogEntry & {
      driftDetails: {
        reason: string;
        // biome-ignore lint/suspicious/noExplicitAny: Flexible diff structure
        expected: any;
        // biome-ignore lint/suspicious/noExplicitAny: Flexible diff structure
        actual: any;
        mismatchType: string;
      };
      severity: PricingDriftSeverity;
    },
  ): Promise<void> {
    await this.logEvent({
      ...entry,
      event: PricingAuditEventType.PRICING_DRIFT_DETECTED,
    });
  }
}
