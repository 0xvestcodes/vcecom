import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { customerWallets, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { WalletTransactionsService } from "./wallet-transactions.service";

@Injectable()
export class WalletService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly walletTransactionsService: WalletTransactionsService,
  ) {}

  /**
   * Get or create wallet for a customer
   */
  async getOrCreateWallet(customerId: string) {
    try {
      let [wallet] = await this.db
        .select()
        .from(customerWallets)
        .where(eq(customerWallets.customerId, customerId))
        .limit(1);

      if (!wallet) {
        [wallet] = await this.db
          .insert(customerWallets)
          .values({
            customerId,
            walletBalance: 0,
            loyaltyPoints: 0,
            totalEarned: 0,
            totalRedeemed: 0,
            totalPointsEarned: 0,
            totalPointsRedeemed: 0,
          })
          .returning();

        this.logger.info(
          createLogContext(this.contextService, "getOrCreateWallet", {
            customerId,
            walletId: wallet.id,
          }),
          "Wallet created for customer",
        );
      }

      return wallet;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getOrCreateWallet", error, {
          customerId,
        }),
        "Failed to get or create wallet",
      );
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(customerId: string) {
    const wallet = await this.getOrCreateWallet(customerId);
    return {
      walletBalance: wallet.walletBalance,
      loyaltyPoints: wallet.loyaltyPoints,
      totalEarned: wallet.totalEarned,
      totalRedeemed: wallet.totalRedeemed,
      totalPointsEarned: wallet.totalPointsEarned,
      totalPointsRedeemed: wallet.totalPointsRedeemed,
    };
  }

  /**
   * Credit wallet (add money)
   */
  async creditWallet(
    customerId: string,
    amount: number,
    description: string,
    options?: {
      orderId?: string;
      refundId?: string;
      adminId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (amount <= 0) {
      throw new BadRequestException("Amount must be greater than 0");
    }

    return await this.db.transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(customerId);

      const newBalance = wallet.walletBalance + amount;
      const newTotalEarned = wallet.totalEarned + amount;

      // Update wallet
      const [updatedWallet] = await tx
        .update(customerWallets)
        .set({
          walletBalance: newBalance,
          totalEarned: newTotalEarned,
          updatedAt: new Date(),
        })
        .where(eq(customerWallets.id, wallet.id))
        .returning();

      // Create transaction record
      await this.walletTransactionsService.createTransaction({
        customerId,
        type: options?.refundId
          ? "refund"
          : options?.adminId
            ? "admin_adjustment"
            : "credit",
        amount,
        balanceAfter: newBalance,
        pointsAfter: updatedWallet.loyaltyPoints,
        orderId: options?.orderId,
        refundId: options?.refundId,
        description,
        metadata: {
          ...options?.metadata,
          adminId: options?.adminId,
        },
      });

      this.logger.info(
        createLogContext(this.contextService, "creditWallet", {
          customerId,
          amount,
          newBalance,
        }),
        "Wallet credited",
      );

      return updatedWallet;
    });
  }

  /**
   * Debit wallet (subtract money)
   */
  async debitWallet(
    customerId: string,
    amount: number,
    description: string,
    options?: {
      orderId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (amount <= 0) {
      throw new BadRequestException("Amount must be greater than 0");
    }

    return await this.db.transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(customerId);

      if (wallet.walletBalance < amount) {
        throw new BadRequestException("Insufficient wallet balance");
      }

      const newBalance = wallet.walletBalance - amount;
      const newTotalRedeemed = wallet.totalRedeemed + amount;

      // Update wallet
      const [updatedWallet] = await tx
        .update(customerWallets)
        .set({
          walletBalance: newBalance,
          totalRedeemed: newTotalRedeemed,
          updatedAt: new Date(),
        })
        .where(eq(customerWallets.id, wallet.id))
        .returning();

      // Create transaction record
      await this.walletTransactionsService.createTransaction({
        customerId,
        type: "debit",
        amount,
        balanceAfter: newBalance,
        pointsAfter: updatedWallet.loyaltyPoints,
        orderId: options?.orderId,
        description,
        metadata: options?.metadata,
      });

      this.logger.info(
        createLogContext(this.contextService, "debitWallet", {
          customerId,
          amount,
          newBalance,
        }),
        "Wallet debited",
      );

      return updatedWallet;
    });
  }

  /**
   * Check if customer has sufficient wallet balance
   */
  async hasSufficientBalance(
    customerId: string,
    amount: number,
  ): Promise<boolean> {
    const wallet = await this.getOrCreateWallet(customerId);
    return wallet.walletBalance >= amount;
  }
}
