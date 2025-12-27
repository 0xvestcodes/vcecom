import { addresses, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import type { Database } from "../../modules/database/db";
import { ContextService } from "../logging/context.service";
import { createLogContext } from "../logging/logging.helper";

export interface AddressState {
  state: string;
}

/**
 * Safely lookup address state for GST calculation
 * Returns empty string if address not found or lookup fails
 */
export async function safeAddressStateLookup(
  addressId: string,
  db: Database, // Accept db as parameter instead of importing directly
  logger: PinoLogger,
  contextService: ContextService,
  context: {
    operation: string;
    orderId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  try {
    const addressResult = await db
      .select({ state: addresses.state })
      .from(addresses)
      .where(eq(addresses.id, addressId))
      .limit(1);

    const address = addressResult[0];
    return address?.state || "";
  } catch (error) {
    logger.warn(
      createLogContext(contextService, context.operation, {
        ...context.metadata,
        orderId: context.orderId,
        addressId,
        error: error instanceof Error ? error.message : String(error),
      }),
      "Failed to fetch address state, using default",
    );
    return "";
  }
}

/**
 * Safely lookup full address
 * Returns null if address not found or lookup fails
 */
export async function safeAddressLookup<T extends Record<string, unknown>>(
  addressId: string,
  selectFields: Record<string, unknown>,
  db: Database, // Accept db as parameter instead of importing directly
  logger: PinoLogger,
  contextService: ContextService,
  context: {
    operation: string;
    orderId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<T | null> {
  try {
    const addressResult = await db
      // @ts-expect-error - Drizzle ORM select requires dynamic field selection
      .select(selectFields)
      .from(addresses)
      .where(eq(addresses.id, addressId))
      .limit(1);

    return (addressResult[0] as T) || null;
  } catch (error) {
    logger.warn(
      createLogContext(contextService, context.operation, {
        ...context.metadata,
        orderId: context.orderId,
        addressId,
        error: error instanceof Error ? error.message : String(error),
      }),
      "Failed to fetch address",
    );
    return null;
  }
}
