import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { PricingDriftSeverity } from "../../../pricing/audit/pricing-audit.types";
import { PricingSnapshot } from "../../../pricing/engine/pricing-engine.types";
import { PricingDriftDetectorService } from "../../../pricing/services/pricing-drift-detector.service";
import { OrderValidationService } from "../validation/order-validation.service";
import { OrderPricingService } from "./order-pricing.service";

/**
 * Service responsible for pricing drift detection
 */
@Injectable()
export class OrderPricingDriftService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly pricingDriftDetector: PricingDriftDetectorService,
    private readonly pricingService: OrderPricingService,
    private readonly validationService: OrderValidationService,
  ) {}

  /**
   * Detect pricing drift during order creation
   */
  @Trace({ operation: "OrderPricingDriftService.detectPricingDrift" })
  async detectPricingDrift(
    checkoutSessionId: string,
    orderId: string,
    customerId: string,
    pricingSnapshot: PricingSnapshot | null,
  ): Promise<void> {
    if (!pricingSnapshot) {
      return; // No snapshot to check for drift
    }

    try {
      const customerGroupId =
        await this.validationService.getCustomerGroupId(customerId);
      const currentPriceLists =
        await this.pricingService.getPriceListsForCustomer(customerGroupId);
      const driftResult =
        await this.pricingDriftDetector.detectOrderCreationDrift(
          checkoutSessionId,
          orderId,
          pricingSnapshot,
          currentPriceLists,
        );

      if (
        driftResult.hasDrift &&
        driftResult.severity === PricingDriftSeverity.CRITICAL
      ) {
        this.logger.error(
          createLogContext(this.contextService, "detectPricingDrift", {
            checkoutSessionId,
            orderId,
            hasDrift: driftResult.hasDrift,
            severity: driftResult.severity,
            driftDetails: driftResult.details,
          }),
          "Critical pricing drift detected",
        );
        // Don't throw - order is already created, drift is logged
      } else if (driftResult.hasDrift) {
        this.logger.warn(
          createLogContext(this.contextService, "detectPricingDrift", {
            checkoutSessionId,
            orderId,
            hasDrift: driftResult.hasDrift,
            severity: driftResult.severity,
          }),
          "Pricing drift detected",
        );
      }
    } catch (error) {
      // Log but don't throw - drift detection failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(this.contextService, "detectPricingDrift", error, {
          checkoutSessionId,
          orderId,
        }),
        "Failed to detect pricing drift",
      );
    }
  }
}
