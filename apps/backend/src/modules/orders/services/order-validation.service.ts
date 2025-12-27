import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { addresses, and, customers, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../../common/config/app.config.service";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { AddressesService } from "../../customers/addresses.service";
import { CustomersService } from "../../customers/customers.service";

/**
 * Service responsible for validating order-related data
 * Handles customer, address, and related validations
 */
@Injectable()
export class OrderValidationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    readonly _customersService: CustomersService,
    readonly _addressesService: AddressesService,
    private readonly appConfigService: AppConfigService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get customer ID for a user
   * @param userId - User ID
   * @returns Customer ID
   * @throws NotFoundException if customer not found
   */
  async getCustomerId(userId: string): Promise<string> {
    try {
      const [customer] = await this.db
        .select()
        .from(customers)
        .where(eq(customers.userId, userId))
        .limit(1);

      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      return customer.id;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(this.contextService, "getCustomerId", error, {
          userId,
        }),
        "Failed to get customer ID",
      );
      throw new NotFoundException("Customer not found");
    }
  }

  /**
   * Get customer group ID for a customer
   * @param customerId - Customer ID
   * @returns Customer group ID or null if not set
   */
  async getCustomerGroupId(customerId: string): Promise<string | null> {
    try {
      const [customer] = await this.db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);
      return customer?.customerGroupId || null;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getCustomerGroupId", error, {
          customerId,
        }),
        "Failed to get customer group",
      );
      return null;
    }
  }

  /**
   * Validate and retrieve shipping and billing addresses for a customer
   * @param customerId - Customer ID
   * @param shippingAddressId - Shipping address ID
   * @param billingAddressId - Billing address ID
   * @returns Object containing validated shipping and billing addresses
   * @throws NotFoundException if addresses are invalid or don't belong to customer
   */
  async getAddresses(
    customerId: string,
    shippingAddressId: string,
    billingAddressId: string,
  ): Promise<{
    shippingAddress: { state: string };
    billingAddress: { state: string };
  }> {
    const [shippingAddress] = await this.db
      .select()
      .from(addresses)
      .where(
        and(
          eq(addresses.id, shippingAddressId),
          eq(addresses.customerId, customerId),
        ),
      )
      .limit(1);

    if (!shippingAddress) {
      throw new NotFoundException(
        "Shipping address not found or does not belong to customer",
      );
    }

    const [billingAddress] = await this.db
      .select()
      .from(addresses)
      .where(
        and(
          eq(addresses.id, billingAddressId),
          eq(addresses.customerId, customerId),
        ),
      )
      .limit(1);

    if (!billingAddress) {
      throw new NotFoundException(
        "Billing address not found or does not belong to customer",
      );
    }

    return { shippingAddress, billingAddress };
  }

  /**
   * Get seller state (default to Maharashtra)
   * @returns Seller state code
   */
  getSellerState(): string {
    return this.appConfigService.getSellerState();
  }
}
