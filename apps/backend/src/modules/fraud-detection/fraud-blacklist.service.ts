import { Inject, Injectable } from "@nestjs/common";
import { and, eq, fraudBlacklists, ilike } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createLogContext } from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";

export type BlacklistType = "email" | "phone" | "address";

export interface BlacklistCheckResult {
  isBlacklisted: boolean;
  blacklistEntry?: {
    id: string;
    type: BlacklistType;
    value: string;
    reason: string | null;
  };
}

/**
 * Service for managing fraud blacklists (email, phone, address)
 */
@Injectable()
export class FraudBlacklistService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Normalize email for blacklist checking (lowercase)
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Normalize phone for blacklist checking (remove spaces, dashes, etc.)
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, ""); // Remove all non-digits
  }

  /**
   * Normalize address for blacklist checking (lowercase, remove extra spaces)
   */
  private normalizeAddress(address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  }): string {
    const normalized = `${address.street.toLowerCase().trim()} ${address.city.toLowerCase().trim()} ${address.state.toLowerCase().trim()} ${address.pincode.trim()}`;
    return normalized.replace(/\s+/g, " ").trim();
  }

  /**
   * Check if email is blacklisted
   */
  @Trace({ operation: "FraudBlacklistService.checkEmail" })
  async checkEmail(email: string): Promise<BlacklistCheckResult> {
    const normalizedEmail = this.normalizeEmail(email);
    const [blacklistEntry] = await this.db
      .select()
      .from(fraudBlacklists)
      .where(
        and(
          eq(fraudBlacklists.type, "email"),
          eq(fraudBlacklists.value, normalizedEmail),
        ),
      )
      .limit(1);

    if (blacklistEntry && blacklistEntry.value === normalizedEmail) {
      this.logger.warn(
        createLogContext(this.contextService, "checkEmail", {
          email: normalizedEmail,
          blacklistId: blacklistEntry.id,
        }),
        "Email found in blacklist",
      );
      return {
        isBlacklisted: true,
        blacklistEntry: {
          id: blacklistEntry.id,
          type: blacklistEntry.type as BlacklistType,
          value: blacklistEntry.value,
          reason: blacklistEntry.reason,
        },
      };
    }

    return { isBlacklisted: false };
  }

  /**
   * Check if phone is blacklisted
   */
  @Trace({ operation: "FraudBlacklistService.checkPhone" })
  async checkPhone(phone: string): Promise<BlacklistCheckResult> {
    const normalizedPhone = this.normalizePhone(phone);
    const [blacklistEntry] = await this.db
      .select()
      .from(fraudBlacklists)
      .where(
        and(
          eq(fraudBlacklists.type, "phone"),
          eq(fraudBlacklists.value, normalizedPhone),
        ),
      )
      .limit(1);

    if (blacklistEntry && blacklistEntry.value === normalizedPhone) {
      this.logger.warn(
        createLogContext(this.contextService, "checkPhone", {
          phone: normalizedPhone,
          blacklistId: blacklistEntry.id,
        }),
        "Phone found in blacklist",
      );
      return {
        isBlacklisted: true,
        blacklistEntry: {
          id: blacklistEntry.id,
          type: blacklistEntry.type as BlacklistType,
          value: blacklistEntry.value,
          reason: blacklistEntry.reason,
        },
      };
    }

    return { isBlacklisted: false };
  }

  /**
   * Check if address is blacklisted
   */
  @Trace({ operation: "FraudBlacklistService.checkAddress" })
  async checkAddress(address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  }): Promise<BlacklistCheckResult> {
    const normalizedAddress = this.normalizeAddress(address);
    const [blacklistEntry] = await this.db
      .select()
      .from(fraudBlacklists)
      .where(
        and(
          eq(fraudBlacklists.type, "address"),
          ilike(fraudBlacklists.value, `%${normalizedAddress}%`),
        ),
      )
      .limit(1);

    if (blacklistEntry) {
      this.logger.warn(
        createLogContext(this.contextService, "checkAddress", {
          address: normalizedAddress,
          blacklistId: blacklistEntry.id,
        }),
        "Address found in blacklist",
      );
      return {
        isBlacklisted: true,
        blacklistEntry: {
          id: blacklistEntry.id,
          type: blacklistEntry.type as BlacklistType,
          value: blacklistEntry.value,
          reason: blacklistEntry.reason,
        },
      };
    }

    return { isBlacklisted: false };
  }

  /**
   * Add entry to blacklist
   */
  @Trace({ operation: "FraudBlacklistService.addToBlacklist" })
  async addToBlacklist(
    type: BlacklistType,
    value: string,
    reason: string | null,
    createdBy: string | null,
  ) {
    let normalizedValue: string;
    if (type === "email") {
      normalizedValue = this.normalizeEmail(value);
    } else if (type === "phone") {
      normalizedValue = this.normalizePhone(value);
    } else {
      normalizedValue = value.toLowerCase().trim();
    }

    // Check if already exists
    const [existing] = await this.db
      .select()
      .from(fraudBlacklists)
      .where(
        and(
          eq(fraudBlacklists.type, type),
          eq(fraudBlacklists.value, normalizedValue),
        ),
      )
      .limit(1);

    if (existing) {
      return existing;
    }

    const [newEntry] = await this.db
      .insert(fraudBlacklists)
      .values({
        type,
        value: normalizedValue,
        reason,
        createdBy: createdBy || null,
      })
      .returning();

    this.logger.info(
      createLogContext(this.contextService, "addToBlacklist", {
        type,
        value: normalizedValue,
        id: newEntry.id,
      }),
      "Added entry to blacklist",
    );

    return newEntry;
  }

  /**
   * Remove entry from blacklist
   */
  @Trace({ operation: "FraudBlacklistService.removeFromBlacklist" })
  async removeFromBlacklist(id: string) {
    const [deleted] = await this.db
      .delete(fraudBlacklists)
      .where(eq(fraudBlacklists.id, id))
      .returning();

    if (deleted) {
      this.logger.info(
        createLogContext(this.contextService, "removeFromBlacklist", {
          id,
        }),
        "Removed entry from blacklist",
      );
    }

    return deleted;
  }

  /**
   * Get all blacklist entries
   */
  @Trace({ operation: "FraudBlacklistService.getAllBlacklists" })
  async getAllBlacklists(type?: BlacklistType) {
    if (type) {
      return this.db
        .select()
        .from(fraudBlacklists)
        .where(eq(fraudBlacklists.type, type));
    }
    return this.db.select().from(fraudBlacklists);
  }
}
