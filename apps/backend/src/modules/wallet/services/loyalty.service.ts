import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { customerWallets, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { LoyaltyRulesService } from "./loyalty-rules.service";
import { WalletService } from "./wallet.service";
import { WalletTransactionsService } from "./wallet-transactions.service";

@Injectable()
export class LoyaltyService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly walletService: WalletService,
    private readonly walletTransactionsService: WalletTransactionsService,
    private readonly loyaltyRulesService: LoyaltyRulesService,
  ) {}

  /**
   * Earn points from order
   */
  async earnPoints(customerId: string, orderValue: number, orderId: string) {
    // Calculate points to earn
    const pointsToEarn = await this.loyaltyRulesService.calculatePointsToEarn(
      customerId,
      orderValue,
    );

    if (pointsToEarn <= 0) {
      return { pointsEarned: 0 };
    }

    return await this.db.transaction(async (tx) => {
      const wallet = await this.walletService.getOrCreateWallet(customerId);

      const newPoints = wallet.loyaltyPoints + pointsToEarn;
      const newTotalPointsEarned = wallet.totalPointsEarned + pointsToEarn;

      // Update wallet
      const [updatedWallet] = await tx
        .update(customerWallets)
        .set({
          loyaltyPoints: newPoints,
          totalPointsEarned: newTotalPointsEarned,
          updatedAt: new Date(),
        })
        .where(eq(customerWallets.customerId, customerId))
        .returning();

      // Create transaction record
      await this.walletTransactionsService.createTransaction({
        customerId,
        type: "points_earned",
        points: pointsToEarn,
        balanceAfter: updatedWallet.walletBalance,
        pointsAfter: newPoints,
        orderId,
        description: `Earned ${pointsToEarn} points from order`,
        metadata: {
          orderValue,
        },
      });

      this.logger.info(
        createLogContext(this.contextService, "earnPoints", {
          customerId,
          pointsToEarn,
          orderId,
          newPoints,
        }),
        "Points earned",
      );

      return { pointsEarned: pointsToEarn };
    });
  }

  /**
   * Redeem points for discount
   */
  async redeemPoints(
    customerId: string,
    pointsToRedeem: number,
    orderValue: number,
    orderId?: string,
  ) {
    if (pointsToRedeem <= 0) {
      throw new BadRequestException("Points to redeem must be greater than 0");
    }

    // Calculate discount amount
    const { discountAmount, pointsUsed } =
      await this.loyaltyRulesService.calculateDiscountFromPoints(
        customerId,
        pointsToRedeem,
        orderValue,
      );

    return await this.db.transaction(async (tx) => {
      const wallet = await this.walletService.getOrCreateWallet(customerId);

      if (wallet.loyaltyPoints < pointsUsed) {
        throw new BadRequestException("Insufficient points");
      }

      const newPoints = wallet.loyaltyPoints - pointsUsed;
      const newTotalPointsRedeemed = wallet.totalPointsRedeemed + pointsUsed;

      // Update wallet
      const [updatedWallet] = await tx
        .update(customerWallets)
        .set({
          loyaltyPoints: newPoints,
          totalPointsRedeemed: newTotalPointsRedeemed,
          updatedAt: new Date(),
        })
        .where(eq(customerWallets.customerId, customerId))
        .returning();

      // Create transaction record
      await this.walletTransactionsService.createTransaction({
        customerId,
        type: "points_redeemed",
        points: pointsUsed,
        balanceAfter: updatedWallet.walletBalance,
        pointsAfter: newPoints,
        orderId,
        description: `Redeemed ${pointsUsed} points for ₹${discountAmount.toFixed(2)} discount`,
        metadata: {
          discountAmount,
          orderValue,
        },
      });

      this.logger.info(
        createLogContext(this.contextService, "redeemPoints", {
          customerId,
          pointsUsed,
          discountAmount,
          orderId,
          newPoints,
        }),
        "Points redeemed",
      );

      return {
        pointsUsed,
        discountAmount,
      };
    });
  }

  /**
   * Get points balance
   */
  async getPointsBalance(customerId: string) {
    const wallet = await this.walletService.getOrCreateWallet(customerId);
    return {
      points: wallet.loyaltyPoints,
      totalEarned: wallet.totalPointsEarned,
      totalRedeemed: wallet.totalPointsRedeemed,
    };
  }
}
