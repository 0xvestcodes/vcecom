import { Inject, Injectable } from "@nestjs/common";
import { addresses, and, customers, eq, ilike, inArray, ne } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createLogContext } from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";

export interface DuplicateCustomerResult {
  isDuplicate: boolean;
  duplicateCustomers: Array<{
    id: string;
    email: string;
    phone: string;
    name: string;
    createdAt: Date;
  }>;
  matchReasons: string[];
}

/**
 * Service for detecting duplicate customers based on contact information
 */
@Injectable()
export class FraudDuplicateDetectionService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Normalize phone for comparison
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, ""); // Remove all non-digits
  }

  /**
   * Normalize email for comparison
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Check for duplicate customers based on email, phone, or address
   */
  @Trace({ operation: "FraudDuplicateDetectionService.checkDuplicateCustomer" })
  async checkDuplicateCustomer(
    customerId: string,
    email: string,
    phone: string,
    addressId: string,
  ): Promise<DuplicateCustomerResult> {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedPhone = this.normalizePhone(phone);
    const matchReasons: string[] = [];
    const duplicateCustomers: DuplicateCustomerResult["duplicateCustomers"] =
      [];

    // Get current customer
    const [currentCustomer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (!currentCustomer) {
      return {
        isDuplicate: false,
        duplicateCustomers: [],
        matchReasons: [],
      };
    }

    // Check for duplicate email (excluding current customer)
    const customersWithSameEmail = await this.db
      .select()
      .from(customers)
      .where(
        and(eq(customers.email, normalizedEmail), ne(customers.id, customerId)),
      );

    if (customersWithSameEmail.length > 0) {
      matchReasons.push("email");
      duplicateCustomers.push(
        ...customersWithSameEmail.map((c) => ({
          id: c.id,
          email: c.email,
          phone: c.phone,
          name: c.name,
          createdAt: c.createdAt,
        })),
      );
    }

    // Check for duplicate phone (excluding current customer)
    const customersWithSamePhone = await this.db
      .select()
      .from(customers)
      .where(
        and(eq(customers.phone, normalizedPhone), ne(customers.id, customerId)),
      );

    if (customersWithSamePhone.length > 0) {
      if (!matchReasons.includes("phone")) {
        matchReasons.push("phone");
      }
      // Add customers not already in the list
      for (const c of customersWithSamePhone) {
        if (!duplicateCustomers.find((d) => d.id === c.id)) {
          duplicateCustomers.push({
            id: c.id,
            email: c.email,
            phone: c.phone,
            name: c.name,
            createdAt: c.createdAt,
          });
        }
      }
    }

    // Check for duplicate address (same street, city, state, pincode)
    if (addressId) {
      const [currentAddress] = await this.db
        .select()
        .from(addresses)
        .where(eq(addresses.id, addressId))
        .limit(1);

      if (currentAddress) {
        const addressesWithSameDetails = await this.db
          .select({
            customerId: addresses.customerId,
          })
          .from(addresses)
          .innerJoin(customers, eq(addresses.customerId, customers.id))
          .where(
            and(
              ilike(addresses.street, currentAddress.street),
              ilike(addresses.city, currentAddress.city),
              ilike(addresses.state, currentAddress.state),
              eq(addresses.pincode, currentAddress.pincode),
              ne(customers.id, customerId),
            ),
          )
          .groupBy(addresses.customerId);

        if (addressesWithSameDetails.length > 0) {
          const customerIds = addressesWithSameDetails.map((a) => a.customerId);
          if (customerIds.length > 0) {
            const customersWithSameAddress = await this.db
              .select()
              .from(customers)
              .where(inArray(customers.id, customerIds));

            if (customersWithSameAddress.length > 0) {
              if (!matchReasons.includes("address")) {
                matchReasons.push("address");
              }
              // Add customers not already in the list
              for (const c of customersWithSameAddress) {
                if (!duplicateCustomers.find((d) => d.id === c.id)) {
                  duplicateCustomers.push({
                    id: c.id,
                    email: c.email,
                    phone: c.phone,
                    name: c.name,
                    createdAt: c.createdAt,
                  });
                }
              }
            }
          }
        }
      }
    }

    const isDuplicate = duplicateCustomers.length > 0;

    if (isDuplicate) {
      this.logger.warn(
        createLogContext(this.contextService, "checkDuplicateCustomer", {
          customerId,
          duplicateCount: duplicateCustomers.length,
          matchReasons,
        }),
        "Duplicate customer detected",
      );
    }

    return {
      isDuplicate,
      duplicateCustomers,
      matchReasons,
    };
  }
}
