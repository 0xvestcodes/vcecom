import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { DiscountSnapshot } from "../../../discounts/engine/discount-engine.types";
import { DiscountSnapshotValidator } from "../../../discounts/services/discount-snapshot-validator.service";
import { RulesetBundleService } from "../../../discounts/services/ruleset-bundle.service";
import { PricingSnapshot } from "../../../pricing/engine/pricing-engine.types";
import { PricingSnapshotValidator } from "../../../pricing/services/pricing-snapshot-validator.service";
import { OrderDiscountService } from "../discount/order-discount.service";

/**
 * Service responsible for snapshot validation
 * Handles pricing and discount snapshot validation
 */
@Injectable()
export class OrderSnapshotValidationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly pricingSnapshotValidator: PricingSnapshotValidator,
    private readonly discountSnapshotValidator: DiscountSnapshotValidator,
    private readonly bundleService: RulesetBundleService,
    private readonly discountService: OrderDiscountService,
  ) {}

  /**
   * Validate pricing snapshot and return effective subtotal
   */
  @Trace({
    operation: "OrderSnapshotValidationService.validatePricingSnapshot",
  })
  async validatePricingSnapshot(
    checkoutSessionId: string,
    pricingSnapshot: PricingSnapshot | null,
    baseSubtotal: number,
  ): Promise<{
    isValid: boolean;
    effectiveSubtotal: number;
  }> {
    if (!pricingSnapshot) {
      return {
        isValid: false,
        effectiveSubtotal: baseSubtotal,
      };
    }

    try {
      this.pricingSnapshotValidator.validate(pricingSnapshot);
      // Safely access totalEffectivePrice with fallback to baseSubtotal
      const effectiveSubtotal =
        pricingSnapshot?.totalEffectivePrice !== undefined &&
        !Number.isNaN(pricingSnapshot.totalEffectivePrice) &&
        pricingSnapshot.totalEffectivePrice >= 0
          ? pricingSnapshot.totalEffectivePrice
          : baseSubtotal;
      return {
        isValid: true,
        effectiveSubtotal,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validatePricingSnapshot",
          error,
          { checkoutSessionId },
        ),
        "Pricing snapshot validation failed",
      );
      // Continue with base subtotal if snapshot invalid
      return {
        isValid: false,
        effectiveSubtotal: baseSubtotal,
      };
    }
  }

  /**
   * Validate discount snapshot
   */
  @Trace({
    operation: "OrderSnapshotValidationService.validateDiscountSnapshot",
  })
  async validateDiscountSnapshot(
    checkoutSessionId: string,
    discountSnapshot: DiscountSnapshot | null,
    snapshotTotal: number,
  ): Promise<{
    isValid: boolean;
  }> {
    if (!discountSnapshot) {
      return { isValid: false };
    }

    // Validate snapshot version exists (bundle available)
    if (discountSnapshot.rulesetVersion) {
      const bundle = await this.bundleService.getBundle(
        discountSnapshot.rulesetVersion,
      );
      if (!bundle) {
        this.logger.warn(
          createLogContext(this.contextService, "validateDiscountSnapshot", {
            checkoutSessionId,
            rulesetVersion: discountSnapshot.rulesetVersion,
          }),
          "Bundle not found for snapshot, but continuing with order creation",
        );
      }
    }

    try {
      // Validate snapshot integrity
      // Note: Payment intent amount validation is skipped as amount is not stored in PaymentIntent
      // The snapshot total itself is what was sent to payment provider, so we validate snapshot structure
      this.discountSnapshotValidator.validateSnapshot(
        discountSnapshot,
        [], // Applied discounts not needed for validation (snapshot already contains them)
        snapshotTotal, // Use snapshot total + GST + shipping for validation
      );
      return { isValid: true };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateDiscountSnapshot",
          error,
          { checkoutSessionId },
        ),
        "Discount snapshot validation failed",
      );
      return { isValid: false };
    }
  }

  /**
   * Validate discount snapshot using discount service
   */
  @Trace({
    operation:
      "OrderSnapshotValidationService.validateDiscountSnapshotViaService",
  })
  async validateDiscountSnapshotViaService(
    checkoutSessionId: string,
    discountSnapshot: DiscountSnapshot | null,
    snapshotTotal: number,
  ): Promise<{
    isValid: boolean;
    discountAmount: number;
  }> {
    if (!discountSnapshot) {
      return { isValid: false, discountAmount: 0 };
    }

    try {
      const validationResult =
        await this.discountService.validateDiscountSnapshot(
          checkoutSessionId,
          discountSnapshot,
          snapshotTotal,
        );
      return {
        isValid: true,
        discountAmount: validationResult.discountAmount,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateDiscountSnapshotViaService",
          error,
          { checkoutSessionId },
        ),
        "Discount snapshot validation failed",
      );
      return { isValid: false, discountAmount: 0 };
    }
  }
}
