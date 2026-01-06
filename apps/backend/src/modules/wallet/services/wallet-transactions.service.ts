import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  desc,
  eq,
  sql,
  walletTransactions,
  walletTransactionTypeEnum,
} from "@vcecom/db";
import { SQL } from "drizzle-orm";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

@Injectable()
export class WalletTransactionsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get transaction history for a customer
   */
  async getTransactionHistory(
    customerId: string,
    options?: {
      limit?: number;
      offset?: number;
      type?: string;
    },
  ) {
    try {
      const conditions = [eq(walletTransactions.customerId, customerId)];

      if (options?.type) {
        conditions.push(
          eq(
            walletTransactions.type,
            options.type as (typeof walletTransactionTypeEnum.enumValues)[number],
          ),
        );
      }

      const transactions = await this.db
        .select()
        .from(walletTransactions)
        .where(and(...conditions))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(options?.limit || 50)
        .offset(options?.offset || 0);

      const total = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(walletTransactions)
        .where(and(...conditions));

      return {
        transactions: transactions.map((t) => ({
          ...t,
          orderId: t.orderId ?? undefined,
          refundId: t.refundId ?? undefined,
          metadata: t.metadata ?? undefined,
        })),
        total: Number(total[0]?.count || 0),
        limit: options?.limit || 50,
        offset: options?.offset || 0,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getTransactionHistory",
          error,
          { customerId },
        ),
        "Failed to get transaction history",
      );
      throw error;
    }
  }

  /**
   * Get all transactions (admin)
   */
  async getAllTransactions(options?: {
    limit?: number;
    offset?: number;
    customerId?: string;
    type?: string;
    orderId?: string;
  }) {
    try {
      const conditions: SQL[] = [];

      if (options?.customerId) {
        conditions.push(eq(walletTransactions.customerId, options.customerId));
      }

      if (options?.type) {
        conditions.push(
          eq(
            walletTransactions.type,
            options.type as (typeof walletTransactionTypeEnum.enumValues)[number],
          ),
        );
      }

      if (options?.orderId) {
        conditions.push(eq(walletTransactions.orderId, options.orderId));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const transactions = await this.db
        .select()
        .from(walletTransactions)
        .where(whereClause)
        .orderBy(desc(walletTransactions.createdAt))
        .limit(options?.limit || 50)
        .offset(options?.offset || 0);

      const total = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(walletTransactions)
        .where(whereClause);

      return {
        transactions: transactions.map((t) => ({
          ...t,
          orderId: t.orderId ?? undefined,
          refundId: t.refundId ?? undefined,
          metadata: t.metadata ?? undefined,
        })),
        total: Number(total[0]?.count || 0),
        limit: options?.limit || 50,
        offset: options?.offset || 0,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getAllTransactions", error, {
          options,
        }),
        "Failed to get all transactions",
      );
      throw error;
    }
  }

  /**
   * Create a transaction record
   * This is called by wallet.service.ts and loyalty.service.ts
   */
  async createTransaction(data: {
    customerId: string;
    type:
      | "credit"
      | "debit"
      | "points_earned"
      | "points_redeemed"
      | "refund"
      | "admin_adjustment"
      | "promotion";
    amount?: number;
    points?: number;
    balanceAfter: number;
    pointsAfter: number;
    orderId?: string;
    refundId?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      const [transaction] = await this.db
        .insert(walletTransactions)
        .values({
          customerId: data.customerId,
          type: data.type,
          amount: data.amount || 0,
          points: data.points || 0,
          balanceAfter: data.balanceAfter,
          pointsAfter: data.pointsAfter,
          orderId: data.orderId || null,
          refundId: data.refundId || null,
          description: data.description,
          metadata: data.metadata || null,
        })
        .returning();

      this.logger.info(
        createLogContext(this.contextService, "createTransaction", {
          transactionId: transaction.id,
          customerId: data.customerId,
          type: data.type,
        }),
        "Wallet transaction created",
      );

      return transaction;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "createTransaction", error, {
          data,
        }),
        "Failed to create transaction",
      );
      throw error;
    }
  }
}
