import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, refundReconciliation } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

export interface ReconciliationResult {
  id: string;
  refundId: string;
  providerRefundId: string;
  gateway: string;
  expectedAmount: number;
  actualAmount: number | null;
  status: "pending" | "reconciled" | "mismatch" | "failed";
  reconciledAt: Date | null;
  notes: string | null;
}

@Injectable()
export class RefundReconciliationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Create reconciliation record for a refund
   */
  async createReconciliation(
    refundId: string,
    providerRefundId: string,
    gateway: "razorpay" | "cashfree" | "payu",
    expectedAmount: number,
  ): Promise<ReconciliationResult> {
    const [reconciliation] = await this.db
      .insert(refundReconciliation)
      .values({
        refundId,
        providerRefundId,
        gateway,
        expectedAmount,
        status: "pending",
      })
      .returning();

    this.logger.info(
      createLogContext(this.contextService, "createReconciliation", {
        reconciliationId: reconciliation.id,
        refundId,
        providerRefundId,
        gateway,
        expectedAmount,
      }),
      "Reconciliation record created",
    );

    return {
      id: reconciliation.id,
      refundId: reconciliation.refundId,
      providerRefundId: reconciliation.providerRefundId,
      gateway: reconciliation.gateway,
      expectedAmount: Number(reconciliation.expectedAmount),
      actualAmount: reconciliation.actualAmount
        ? Number(reconciliation.actualAmount)
        : null,
      status: reconciliation.status as
        | "pending"
        | "reconciled"
        | "mismatch"
        | "failed",
      reconciledAt: reconciliation.reconciledAt,
      notes: reconciliation.notes,
    };
  }

  /**
   * Update reconciliation with actual refund amount
   */
  async updateReconciliation(
    reconciliationId: string,
    actualAmount: number,
    status?: "reconciled" | "mismatch" | "failed",
  ): Promise<ReconciliationResult> {
    const [existing] = await this.db
      .select()
      .from(refundReconciliation)
      .where(eq(refundReconciliation.id, reconciliationId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Reconciliation record not found");
    }

    // Determine status if not provided
    let finalStatus = status;
    if (!finalStatus) {
      const expectedAmount = Number(existing.expectedAmount);
      const difference = Math.abs(actualAmount - expectedAmount);
      const tolerance = 0.01; // 1 paise tolerance

      if (difference <= tolerance) {
        finalStatus = "reconciled";
      } else {
        finalStatus = "mismatch";
      }
    }

    const [updated] = await this.db
      .update(refundReconciliation)
      .set({
        actualAmount,
        status: finalStatus,
        reconciledAt: finalStatus === "reconciled" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(refundReconciliation.id, reconciliationId))
      .returning();

    // Log mismatch if detected
    if (finalStatus === "mismatch") {
      const expectedAmount = Number(existing.expectedAmount);
      const difference = actualAmount - expectedAmount;
      this.logger.warn(
        createLogContext(this.contextService, "updateReconciliation", {
          reconciliationId,
          refundId: existing.refundId,
          expectedAmount,
          actualAmount,
          difference,
        }),
        "Refund amount mismatch detected",
      );
    }

    return {
      id: updated.id,
      refundId: updated.refundId,
      providerRefundId: updated.providerRefundId,
      gateway: updated.gateway,
      expectedAmount: Number(updated.expectedAmount),
      actualAmount: updated.actualAmount ? Number(updated.actualAmount) : null,
      status: updated.status as
        | "pending"
        | "reconciled"
        | "mismatch"
        | "failed",
      reconciledAt: updated.reconciledAt,
      notes: updated.notes,
    };
  }

  /**
   * Get reconciliation by refund ID
   */
  async getByRefundId(refundId: string): Promise<ReconciliationResult | null> {
    const [reconciliation] = await this.db
      .select()
      .from(refundReconciliation)
      .where(eq(refundReconciliation.refundId, refundId))
      .limit(1);

    if (!reconciliation) {
      return null;
    }

    return {
      id: reconciliation.id,
      refundId: reconciliation.refundId,
      providerRefundId: reconciliation.providerRefundId,
      gateway: reconciliation.gateway,
      expectedAmount: Number(reconciliation.expectedAmount),
      actualAmount: reconciliation.actualAmount
        ? Number(reconciliation.actualAmount)
        : null,
      status: reconciliation.status as
        | "pending"
        | "reconciled"
        | "mismatch"
        | "failed",
      reconciledAt: reconciliation.reconciledAt,
      notes: reconciliation.notes,
    };
  }

  /**
   * Get all pending reconciliations
   */
  async getPendingReconciliations(): Promise<ReconciliationResult[]> {
    const reconciliations = await this.db
      .select()
      .from(refundReconciliation)
      .where(eq(refundReconciliation.status, "pending"));

    return reconciliations.map((r) => ({
      id: r.id,
      refundId: r.refundId,
      providerRefundId: r.providerRefundId,
      gateway: r.gateway,
      expectedAmount: Number(r.expectedAmount),
      actualAmount: r.actualAmount ? Number(r.actualAmount) : null,
      status: r.status as "pending" | "reconciled" | "mismatch" | "failed",
      reconciledAt: r.reconciledAt,
      notes: r.notes,
    }));
  }

  /**
   * Get reconciliations with mismatches
   */
  async getMismatches(): Promise<ReconciliationResult[]> {
    const reconciliations = await this.db
      .select()
      .from(refundReconciliation)
      .where(eq(refundReconciliation.status, "mismatch"));

    return reconciliations.map((r) => ({
      id: r.id,
      refundId: r.refundId,
      providerRefundId: r.providerRefundId,
      gateway: r.gateway,
      expectedAmount: Number(r.expectedAmount),
      actualAmount: r.actualAmount ? Number(r.actualAmount) : null,
      status: r.status as "pending" | "reconciled" | "mismatch" | "failed",
      reconciledAt: r.reconciledAt,
      notes: r.notes,
    }));
  }

  /**
   * Add notes to reconciliation
   */
  async addNotes(
    reconciliationId: string,
    notes: string,
  ): Promise<ReconciliationResult> {
    const [updated] = await this.db
      .update(refundReconciliation)
      .set({
        notes,
        updatedAt: new Date(),
      })
      .where(eq(refundReconciliation.id, reconciliationId))
      .returning();

    if (!updated) {
      throw new NotFoundException("Reconciliation record not found");
    }

    return {
      id: updated.id,
      refundId: updated.refundId,
      providerRefundId: updated.providerRefundId,
      gateway: updated.gateway,
      expectedAmount: Number(updated.expectedAmount),
      actualAmount: updated.actualAmount ? Number(updated.actualAmount) : null,
      status: updated.status as
        | "pending"
        | "reconciled"
        | "mismatch"
        | "failed",
      reconciledAt: updated.reconciledAt,
      notes: updated.notes,
    };
  }
}
