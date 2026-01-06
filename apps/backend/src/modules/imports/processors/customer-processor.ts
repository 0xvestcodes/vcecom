import { Inject, Injectable } from "@nestjs/common";
import { customerGroups, customers, eq, stores, users } from "@vcecom/db";
import * as bcrypt from "bcrypt";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { StoreContextService } from "../../../common/store-context/store-context.service";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { CustomerValidator } from "../validators/customer-validator";

export interface ProcessResult {
  success: boolean;
  customerId?: string;
  error?: string;
}

@Injectable()
export class CustomerProcessor {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly validator: CustomerValidator,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly storeContextService: StoreContextService,
  ) {}

  /**
   * Get default store ID helper
   */
  private async getDefaultStoreId(): Promise<string> {
    const contextStoreId = this.storeContextService.getStoreId();
    if (contextStoreId) {
      return contextStoreId;
    }

    const [defaultStore] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.isDefault, true))
      .limit(1);

    if (defaultStore) {
      return defaultStore.id;
    }

    const [firstStore] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .limit(1);
    if (firstStore) {
      return firstStore.id;
    }

    throw new Error("No store found");
  }

  /**
   * Process a single customer import row
   */
  async process(
    row: Record<string, string>,
    options?: {
      updateExisting?: boolean;
      defaultPassword?: string;
      skipErrors?: boolean;
    },
  ): Promise<ProcessResult> {
    try {
      // Validate row data
      const validation = this.validator.validate(row);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.map((e) => e.errorMessage).join("; "),
        };
      }

      if (!validation.data) {
        return {
          success: false,
          error: "Validation data is missing",
        };
      }

      const data = validation.data;

      // Validate customer group exists if provided
      if (data.customerGroupId) {
        const [group] = await this.db
          .select()
          .from(customerGroups)
          .where(eq(customerGroups.id, data.customerGroupId))
          .limit(1);

        if (!group) {
          return {
            success: false,
            error: `Customer group with ID ${data.customerGroupId} not found`,
          };
        }
      }

      // Check if customer already exists
      const [existingCustomer] = await this.db
        .select()
        .from(customers)
        .where(eq(customers.email, data.email))
        .limit(1);

      if (existingCustomer) {
        if (options?.updateExisting) {
          // Update existing customer
          const [updated] = await this.db
            .update(customers)
            .set({
              name: data.name,
              phone: data.phone,
              gstin: data.gstin || null,
              customerGroupId: data.customerGroupId || null,
              updatedAt: new Date(),
            })
            .where(eq(customers.id, existingCustomer.id))
            .returning();

          return {
            success: true,
            customerId: updated.id,
          };
        } else {
          return {
            success: false,
            error: `Customer with email "${data.email}" already exists`,
          };
        }
      }

      // Check if user already exists
      const [existingUser] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, data.email))
        .limit(1);

      if (existingUser) {
        return {
          success: false,
          error: `User with email "${data.email}" already exists`,
        };
      }

      // Generate default password if not provided
      const defaultPassword =
        options?.defaultPassword || this.generateRandomPassword();

      // Hash password
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      // Create user first
      const [newUser] = await this.db
        .insert(users)
        .values({
          email: data.email,
          passwordHash,
          role: "customer",
        })
        .returning();

      if (!newUser) {
        return {
          success: false,
          error: "Failed to create user",
        };
      }

      // Create customer profile
      const storeId = await this.getDefaultStoreId();
      const [newCustomer] = await this.db
        .insert(customers)
        .values({
          userId: newUser.id,
          storeId,
          email: data.email,
          phone: data.phone,
          name: data.name,
          gstin: data.gstin || null,
          customerGroupId: data.customerGroupId || null,
          isGuest: false,
          emailVerified: false,
        })
        .returning();

      if (!newCustomer) {
        // Rollback: delete user if customer creation fails
        await this.db.delete(users).where(eq(users.id, newUser.id));
        return {
          success: false,
          error: "Failed to create customer profile",
        };
      }

      return {
        success: true,
        customerId: newCustomer.id,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "process", error, { row }),
        "Failed to process customer import row",
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generate a random password for imported customers
   */
  private generateRandomPassword(): string {
    const length = 12;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}
