import { Inject, Injectable } from "@nestjs/common";
import {
  taxAuditEventTypeEnum,
  taxAuditLogs,
  taxAuditSeverityEnum,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  TaxAuditEventType,
  TaxAuditLogEntry,
  TaxAuditSeverity,
} from "../audit/tax-audit.types";
import { TAX_ENGINE_VERSION } from "../engine/tax-engine.constants";
import type { TaxEngineResult, TaxSnapshot } from "../engine/tax-engine.types";

@Injectable()
export class TaxAuditService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Log tax audit event (async, non-blocking)
   */
  async logEvent(entry: TaxAuditLogEntry): Promise<void> {
    try {
      await this.db.insert(taxAuditLogs).values({
        timestamp: new Date(),
        event: entry.event as (typeof taxAuditEventTypeEnum.enumValues)[number],
        cartId: entry.cartId,
        checkoutId: entry.checkoutId,
        orderId: entry.orderId,
        customerId: entry.customerId,
        productId: entry.productId,
        variantId: entry.variantId,
        appliedTaxRules: entry.appliedTaxRules,
        appliedExemptions: entry.appliedExemptions,
        resolvedGstRate: entry.resolvedGstRate,
        baseAmount: entry.baseAmount,
        taxAmount: entry.taxAmount,
        calculationDetails: entry.calculationDetails,
        snapshotVersion: entry.snapshotVersion,
        ruleHash: entry.ruleHash,
        engineVersion: entry.engineVersion,
        driftDetails: entry.driftDetails,
        severity: (entry.severity ||
          TaxAuditSeverity.INFO) as (typeof taxAuditSeverityEnum.enumValues)[number],
        metadata: entry.metadata,
      });
    } catch (error) {
      // Log error but don't throw - audit logging should never break core operations
      this.logger.error(
        createErrorContext(this.contextService, "logEvent", error, {
          event: entry.event,
        }),
        "Failed to log tax audit event",
      );
    }
  }

  /**
   * Log tax engine run
   */
  async logEngineRun(
    cartId: string,
    engineResult: TaxEngineResult,
  ): Promise<void> {
    await this.logEvent({
      event: TaxAuditEventType.TAX_ENGINE_RUN,
      cartId,
      baseAmount: engineResult.totalBaseAmount,
      taxAmount: engineResult.totalTaxAmount,
      resolvedGstRate: engineResult.variantTaxes[0]?.resolvedGstRate,
      calculationDetails: engineResult.taxBreakdown,
      appliedTaxRules: engineResult.variantTaxes
        .map((vt) => vt.appliedTaxRule)
        .filter((rule): rule is NonNullable<typeof rule> => rule !== undefined)
        .map((rule) => ({
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          ruleType: rule.ruleType,
          gstRate: rule.gstRate,
        })),
      appliedExemptions: engineResult.variantTaxes
        .map((vt) => vt.appliedExemption)
        .filter(
          (exemption): exemption is NonNullable<typeof exemption> =>
            exemption !== undefined,
        )
        .map((exemption) => ({
          exemptionId: exemption.exemptionId,
          exemptionName: exemption.exemptionName,
          exemptionType: exemption.exemptionType,
        })),
      engineVersion: TAX_ENGINE_VERSION,
    });
  }

  /**
   * Log snapshot creation
   */
  async logSnapshotCreated(
    checkoutId: string,
    snapshot: TaxSnapshot,
  ): Promise<void> {
    await this.logEvent({
      event: TaxAuditEventType.TAX_SNAPSHOT_CREATED,
      checkoutId,
      snapshotVersion: snapshot.computedAt,
      ruleHash: snapshot.ruleHash,
      engineVersion: snapshot.engineVersion,
      baseAmount: snapshot.totalBaseAmount,
      taxAmount: snapshot.totalTaxAmount,
      calculationDetails: snapshot.taxBreakdown,
      appliedTaxRules: snapshot.variantTaxes
        .map((vt) => vt.appliedTaxRule)
        .filter((rule): rule is NonNullable<typeof rule> => rule !== undefined)
        .map((rule) => ({
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          ruleType: rule.ruleType,
          gstRate: rule.gstRate,
        })),
      appliedExemptions: snapshot.variantTaxes
        .map((vt) => vt.appliedExemption)
        .filter(
          (exemption): exemption is NonNullable<typeof exemption> =>
            exemption !== undefined,
        )
        .map((exemption) => ({
          exemptionId: exemption.exemptionId,
          exemptionName: exemption.exemptionName,
          exemptionType: exemption.exemptionType,
        })),
    });
  }

  /**
   * Log snapshot usage for order creation
   */
  async logSnapshotUsed(
    checkoutId: string,
    orderId: string,
    snapshot: TaxSnapshot,
  ): Promise<void> {
    await this.logEvent({
      event: TaxAuditEventType.TAX_SNAPSHOT_USED,
      checkoutId,
      orderId,
      snapshotVersion: snapshot.computedAt,
      ruleHash: snapshot.ruleHash,
      engineVersion: snapshot.engineVersion,
      baseAmount: snapshot.totalBaseAmount,
      taxAmount: snapshot.totalTaxAmount,
      calculationDetails: snapshot.taxBreakdown,
      appliedTaxRules: snapshot.variantTaxes
        .map((vt) => vt.appliedTaxRule)
        .filter((rule): rule is NonNullable<typeof rule> => rule !== undefined)
        .map((rule) => ({
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          ruleType: rule.ruleType,
          gstRate: rule.gstRate,
        })),
      appliedExemptions: snapshot.variantTaxes
        .map((vt) => vt.appliedExemption)
        .filter(
          (exemption): exemption is NonNullable<typeof exemption> =>
            exemption !== undefined,
        )
        .map((exemption) => ({
          exemptionId: exemption.exemptionId,
          exemptionName: exemption.exemptionName,
          exemptionType: exemption.exemptionType,
        })),
    });
  }

  /**
   * Log tax calculation
   */
  async logCalculation(
    entry: TaxAuditLogEntry & {
      event: TaxAuditEventType.CALCULATION;
    },
  ): Promise<void> {
    await this.logEvent({
      ...entry,
      event: TaxAuditEventType.CALCULATION,
    });
  }

  /**
   * Log drift detection
   */
  async logDrift(
    entry: TaxAuditLogEntry & {
      driftDetails: {
        reason: string;
        // biome-ignore lint/suspicious/noExplicitAny: Flexible expected value type
        expected: any;
        // biome-ignore lint/suspicious/noExplicitAny: Flexible actual value type
        actual: any;
        mismatchType: string;
      };
      severity: TaxAuditSeverity;
    },
  ): Promise<void> {
    await this.logEvent({
      ...entry,
      event: TaxAuditEventType.DRIFT_DETECTED,
    });
  }
}
