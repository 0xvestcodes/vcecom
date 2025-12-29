import { ConflictException, Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { CheckoutMetadata } from "../../../redis-store/dto/checkout-metadata.dto";
import { OrderCheckoutSessionService } from "./order-checkout-session.service";

/**
 * Service responsible for checkout metadata management
 */
@Injectable()
export class OrderMetadataService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly checkoutSessionService: OrderCheckoutSessionService,
  ) {}

  /**
   * Create and store checkout metadata
   */
  @Trace({ operation: "OrderMetadataService.createAndStoreMetadata" })
  async createAndStoreMetadata(
    checkoutSessionId: string,
    metadata: Omit<CheckoutMetadata, "createdAt">,
  ): Promise<void> {
    if (!checkoutSessionId) {
      throw new ConflictException(
        "Checkout session is required for metadata storage",
      );
    }

    const checkoutMetadata: CheckoutMetadata = {
      ...metadata,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.checkoutSessionService.storeMetadata(
        checkoutSessionId,
        checkoutMetadata,
      );
      this.logger.debug(
        createLogContext(this.contextService, "createAndStoreMetadata", {
          checkoutSessionId,
        }),
        "Stored checkout metadata",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "createAndStoreMetadata",
          error,
          { checkoutSessionId },
        ),
        "Failed to store checkout metadata",
      );
      throw new ConflictException(
        "Failed to store checkout metadata - cannot proceed with payment intent creation",
      );
    }
  }
}
