import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { abandonedCartRecoveries, and, customers, eq, sql } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { EmailService } from "../../email/email.service";
import { QueueService } from "../../queue/queue.service";
import { SMSService } from "../../sms/sms.service";
import {
  MAX_RECOVERY_ATTEMPTS,
  RECOVERY_DISCOUNT_PERCENTAGE,
  RECOVERY_EMAIL_DELAY_HOURS,
} from "../carts.constants";
import { CartsService } from "../carts.service";

/**
 * Abandoned Cart Recovery Service
 * Manages recovery workflow including email/SMS sending and discount generation
 */
@Injectable()
export class AbandonedCartRecoveryService implements OnModuleInit {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly emailService: EmailService,
    private readonly smsService: SMSService,
    private readonly queueService: QueueService,
    private readonly cartsService: CartsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    this.logger.info(
      createLogContext(this.contextService, "onModuleInit", {}),
      "Abandoned cart recovery service initialized",
    );
  }

  /**
   * Create recovery record
   */
  async createRecoveryRecord(
    cartId: string,
    customerId: string | null,
    sessionId: string | null,
  ): Promise<typeof abandonedCartRecoveries.$inferSelect> {
    try {
      const [recovery] = await this.db
        .insert(abandonedCartRecoveries)
        .values({
          cartId,
          customerId: customerId || null,
          sessionId: sessionId || null,
          recoveryStatus: "queued",
          detectedAt: new Date(),
        })
        .returning();

      if (!recovery) {
        throw new Error("Failed to create recovery record");
      }

      // Schedule first recovery attempt
      await this.scheduleRecoveryAttempt(recovery.id, 1);

      return recovery;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "createRecoveryRecord", error, {
          cartId,
        }),
        "Failed to create recovery record",
      );
      throw error;
    }
  }

  /**
   * Generate recovery discount code
   */
  async generateRecoveryDiscount(recoveryId: string): Promise<string | null> {
    try {
      // Generate a unique discount code
      const code = `RECOVER${Date.now().toString(36).toUpperCase()}`;

      // Store in recovery record
      await this.db
        .update(abandonedCartRecoveries)
        .set({ recoveryDiscountCode: code })
        .where(eq(abandonedCartRecoveries.id, recoveryId));

      // TODO: Optionally create actual discount in discounts table
      // For now, we'll just store the code and let the discount engine handle it
      // or create it on-demand when customer uses it

      return code;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "generateRecoveryDiscount",
          error,
          { recoveryId },
        ),
        "Failed to generate recovery discount",
      );
      return null;
    }
  }

  /**
   * Send recovery email
   */
  async sendRecoveryEmail(
    recoveryId: string,
    customerEmail: string,
    customerName?: string,
  ): Promise<void> {
    try {
      const [recovery] = await this.db
        .select()
        .from(abandonedCartRecoveries)
        .where(eq(abandonedCartRecoveries.id, recoveryId))
        .limit(1);

      if (!recovery) {
        throw new Error("Recovery record not found");
      }

      // Get cart details
      const cart = await this.cartsService.getCartById(
        recovery.cartId,
        recovery.customerId,
      );

      // Generate discount code if not exists
      let discountCode = recovery.recoveryDiscountCode;
      if (!discountCode && RECOVERY_DISCOUNT_PERCENTAGE > 0) {
        discountCode = await this.generateRecoveryDiscount(recoveryId);
      }

      // Send email
      await this.emailService.sendAbandonedCartRecovery(customerEmail, {
        customerName: customerName || "Customer",
        cartItems: cart.items.map((item) => ({
          name: item.productTitle,
          quantity: item.quantity,
          price: item.pricing.lineTotal,
          thumbnail: item.thumbnail,
        })),
        cartTotal: cart.priceSummary.total,
        discountCode: discountCode || undefined,
        cartLink: `${process.env.STOREFRONT_URL || "http://localhost:3000"}/cart?recovery=${recoveryId}`,
      });

      // Update recovery record
      await this.db
        .update(abandonedCartRecoveries)
        .set({
          recoveryStatus: "email_sent",
          emailSentAt: new Date(),
          recoveryAttempts: sql`${abandonedCartRecoveries.recoveryAttempts} + 1`,
        })
        .where(eq(abandonedCartRecoveries.id, recoveryId));

      this.logger.info(
        createLogContext(this.contextService, "sendRecoveryEmail", {
          recoveryId,
          customerEmail,
        }),
        "Recovery email sent",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "sendRecoveryEmail", error, {
          recoveryId,
        }),
        "Failed to send recovery email",
      );
      throw error;
    }
  }

  /**
   * Send recovery SMS
   */
  async sendRecoverySMS(
    recoveryId: string,
    customerPhone: string,
    customerName?: string,
  ): Promise<void> {
    try {
      const [recovery] = await this.db
        .select()
        .from(abandonedCartRecoveries)
        .where(eq(abandonedCartRecoveries.id, recoveryId))
        .limit(1);

      if (!recovery) {
        throw new Error("Recovery record not found");
      }

      // Get cart details
      const cart = await this.cartsService.getCartById(
        recovery.cartId,
        recovery.customerId,
      );

      // Generate discount code if not exists
      let discountCode = recovery.recoveryDiscountCode;
      if (!discountCode && RECOVERY_DISCOUNT_PERCENTAGE > 0) {
        discountCode = await this.generateRecoveryDiscount(recoveryId);
      }

      // Send SMS
      await this.smsService.sendAbandonedCartRecovery(customerPhone, {
        customerName: customerName,
        cartLink: `${process.env.STOREFRONT_URL || "http://localhost:3000"}/cart?recovery=${recoveryId}`,
        discountCode: discountCode || undefined,
        cartTotal: cart.priceSummary.total,
        itemCount: cart.items.length,
      });

      // Update recovery record
      await this.db
        .update(abandonedCartRecoveries)
        .set({
          recoveryStatus: "sms_sent",
          smsSentAt: new Date(),
          recoveryAttempts: sql`${abandonedCartRecoveries.recoveryAttempts} + 1`,
        })
        .where(eq(abandonedCartRecoveries.id, recoveryId));

      this.logger.info(
        createLogContext(this.contextService, "sendRecoverySMS", {
          recoveryId,
          customerPhone,
        }),
        "Recovery SMS sent",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "sendRecoverySMS", error, {
          recoveryId,
        }),
        "Failed to send recovery SMS",
      );
      throw error;
    }
  }

  /**
   * Mark cart as recovered
   */
  async markAsRecovered(cartId: string, orderId?: string): Promise<void> {
    try {
      const [recovery] = await this.db
        .select()
        .from(abandonedCartRecoveries)
        .where(
          and(
            eq(abandonedCartRecoveries.cartId, cartId),
            sql`${abandonedCartRecoveries.recoveryStatus} != 'recovered'`,
          ),
        )
        .limit(1);

      if (recovery) {
        await this.db
          .update(abandonedCartRecoveries)
          .set({
            recoveryStatus: "recovered",
            recoveredAt: new Date(),
            metadata: orderId
              ? { orderId, ...(recovery.metadata || {}) }
              : recovery.metadata,
          })
          .where(eq(abandonedCartRecoveries.id, recovery.id));

        this.logger.info(
          createLogContext(this.contextService, "markAsRecovered", {
            cartId,
            recoveryId: recovery.id,
            orderId,
          }),
          "Cart marked as recovered",
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "markAsRecovered", error, {
          cartId,
        }),
        "Failed to mark cart as recovered",
      );
      // Don't throw - recovery tracking shouldn't break order creation
    }
  }

  /**
   * Get recovery statistics
   */
  async getRecoveryStats(): Promise<{
    totalAbandoned: number;
    totalRecovered: number;
    recoveryRate: number;
    totalRevenueRecovered: number;
  }> {
    try {
      const stats = await this.db
        .select({
          status: abandonedCartRecoveries.recoveryStatus,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(abandonedCartRecoveries)
        .groupBy(abandonedCartRecoveries.recoveryStatus);

      const totalAbandoned = stats.reduce((sum, s) => sum + s.count, 0);
      const totalRecovered =
        stats.find((s) => s.status === "recovered")?.count || 0;
      const recoveryRate =
        totalAbandoned > 0 ? (totalRecovered / totalAbandoned) * 100 : 0;

      // Calculate revenue recovered (would need to join with orders)
      // For now, return 0
      const totalRevenueRecovered = 0;

      return {
        totalAbandoned,
        totalRecovered,
        recoveryRate,
        totalRevenueRecovered,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getRecoveryStats", error),
        "Failed to get recovery statistics",
      );
      return {
        totalAbandoned: 0,
        totalRecovered: 0,
        recoveryRate: 0,
        totalRevenueRecovered: 0,
      };
    }
  }

  /**
   * Schedule recovery attempt
   */
  private async scheduleRecoveryAttempt(
    recoveryId: string,
    attemptNumber: number,
  ): Promise<void> {
    try {
      if (attemptNumber > MAX_RECOVERY_ATTEMPTS) {
        // Mark as expired
        await this.db
          .update(abandonedCartRecoveries)
          .set({ recoveryStatus: "expired" })
          .where(eq(abandonedCartRecoveries.id, recoveryId));
        return;
      }

      // Calculate delay based on attempt number
      let delayHours = RECOVERY_EMAIL_DELAY_HOURS;
      if (attemptNumber === 2) {
        delayHours = 24; // 24 hours after first attempt
      } else if (attemptNumber === 3) {
        delayHours = 72; // 72 hours after second attempt
      }

      const nextAttemptAt = new Date();
      nextAttemptAt.setHours(nextAttemptAt.getHours() + delayHours);

      await this.db
        .update(abandonedCartRecoveries)
        .set({ nextAttemptAt })
        .where(eq(abandonedCartRecoveries.id, recoveryId));

      // Queue recovery job
      await this.queueService.addJob(
        "abandoned-cart-recovery",
        "process-recovery",
        {
          recoveryId,
          attemptNumber,
        },
        {
          delay: delayHours * 60 * 60 * 1000, // Convert hours to milliseconds
          attempts: 3,
        },
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "scheduleRecoveryAttempt",
          error,
          { recoveryId, attemptNumber },
        ),
        "Failed to schedule recovery attempt",
      );
    }
  }

  /**
   * Process recovery attempt (called by queue processor)
   */
  async processRecoveryAttempt(
    recoveryId: string,
    attemptNumber: number,
  ): Promise<void> {
    try {
      const [recovery] = await this.db
        .select()
        .from(abandonedCartRecoveries)
        .where(eq(abandonedCartRecoveries.id, recoveryId))
        .limit(1);

      if (!recovery) {
        this.logger.warn(
          createLogContext(this.contextService, "processRecoveryAttempt", {
            recoveryId,
          }),
          "Recovery record not found",
        );
        return;
      }

      // Check if already recovered
      if (recovery.recoveryStatus === "recovered") {
        return;
      }

      // Get customer email and phone
      let customerEmail: string | null = null;
      let customerPhone: string | null = null;
      let customerName: string | null = null;

      if (recovery.customerId) {
        const [customer] = await this.db
          .select({
            email: customers.email,
            phone: customers.phone,
            name: customers.name,
          })
          .from(customers)
          .where(eq(customers.id, recovery.customerId))
          .limit(1);

        if (customer) {
          customerEmail = customer.email;
          customerPhone = customer.phone;
          customerName = customer.name;
        }
      }

      // Send recovery messages based on attempt number
      if (attemptNumber === 1) {
        // First attempt: send email
        if (customerEmail) {
          await this.sendRecoveryEmail(
            recoveryId,
            customerEmail,
            customerName || undefined,
          );
        }
        // Schedule SMS for next attempt
        if (customerPhone) {
          await this.scheduleRecoveryAttempt(recoveryId, 2);
        }
      } else if (attemptNumber === 2) {
        // Second attempt: send SMS
        if (customerPhone) {
          await this.sendRecoverySMS(
            recoveryId,
            customerPhone,
            customerName || undefined,
          );
        }
        // Schedule third attempt
        await this.scheduleRecoveryAttempt(recoveryId, 3);
      } else if (attemptNumber === 3) {
        // Third attempt: send both email and SMS
        if (customerEmail) {
          await this.sendRecoveryEmail(
            recoveryId,
            customerEmail,
            customerName || undefined,
          );
        }
        if (customerPhone) {
          await this.sendRecoverySMS(
            recoveryId,
            customerPhone,
            customerName || undefined,
          );
        }
        // Mark as expired after max attempts
        await this.db
          .update(abandonedCartRecoveries)
          .set({ recoveryStatus: "expired" })
          .where(eq(abandonedCartRecoveries.id, recoveryId));
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "processRecoveryAttempt",
          error,
          { recoveryId, attemptNumber },
        ),
        "Failed to process recovery attempt",
      );
      throw error;
    }
  }

  /**
   * Recovery cleanup cron job
   * Runs daily at 2 AM to mark expired recoveries
   */
  @Cron("0 2 * * *") // Daily at 2 AM
  async cleanupExpiredRecoveries() {
    this.logger.debug(
      createLogContext(this.contextService, "cleanupExpiredRecoveries", {}),
      "Starting expired recovery cleanup",
    );

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 days old

      // Mark recoveries older than 7 days as expired
      const _result = await this.db
        .update(abandonedCartRecoveries)
        .set({ recoveryStatus: "expired" })
        .where(
          and(
            sql`${abandonedCartRecoveries.detectedAt} < ${cutoffDate}`,
            sql`${abandonedCartRecoveries.recoveryStatus} != 'recovered'`,
            sql`${abandonedCartRecoveries.recoveryStatus} != 'expired'`,
          ),
        );

      this.logger.info(
        createLogContext(this.contextService, "cleanupExpiredRecoveries", {
          cutoffDate: cutoffDate.toISOString(),
        }),
        "Expired recovery cleanup completed",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "cleanupExpiredRecoveries",
          error,
        ),
        "Failed to run expired recovery cleanup",
      );
    }
  }
}
