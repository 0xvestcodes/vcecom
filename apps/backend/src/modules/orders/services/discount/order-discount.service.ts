import { Inject, Injectable } from "@nestjs/common";
import { customers, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { BundleCartItemMetadata } from "../../../carts/dto/bundle-cart-item.dto";
import { DB_TOKEN } from "../../../database/database.module";
import type { Database } from "../../../database/db";
import { DiscountsService } from "../../../discounts/discounts.service";
import { DiscountResponseDto } from "../../../discounts/dto/discount-response.dto";
import { runDiscountEngine } from "../../../discounts/engine/discount-engine";
import {
  DiscountEngineInput,
  DiscountEngineResult,
  DiscountSnapshot,
} from "../../../discounts/engine/discount-engine.types";
import { createDiscountSnapshot } from "../../../discounts/engine/discount-snapshot.utils";
import { DiscountAuditService } from "../../../discounts/services/discount-audit.service";
import { DiscountProfiler } from "../../../discounts/services/discount-profiler.service";
import { DiscountSnapshotValidator } from "../../../discounts/services/discount-snapshot-validator.service";
import { DriftDetectorService } from "../../../discounts/services/drift-detector.service";
import { HotReloadWatcher } from "../../../discounts/services/hot-reload-watcher.service";
import { RulesetBundleService } from "../../../discounts/services/ruleset-bundle.service";

/**
 * Service responsible for order discount operations
 * Handles discount engine integration, snapshot validation, and drift detection
 */
@Injectable()
export class OrderDiscountService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly discountsService: DiscountsService,
    private readonly discountSnapshotValidator: DiscountSnapshotValidator,
    private readonly discountAuditService: DiscountAuditService,
    private readonly driftDetector: DriftDetectorService,
    private readonly hotReloadWatcher: HotReloadWatcher,
    private readonly bundleService: RulesetBundleService,
    private readonly discountProfiler: DiscountProfiler,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Apply discounts to order using discount engine
   * Runs discount engine and creates discount snapshot
   * @param cartId - Cart ID
   * @param checkoutSessionId - Checkout session ID
   * @param effectiveSubtotal - Effective subtotal after pricing engine
   * @param customerId - Customer ID
   * @param userId - User ID (optional)
   * @param discountCode - Discount code (optional)
   * @param shippingCost - Shipping cost
   * @param cartItemsForEngine - Cart items formatted for discount engine
   * @param bundleCartItems - Bundle cart items
   * @param bundleVariantMapping - Mapping of bundle items to variant IDs
   * @param flattenedBundleVariants - Flattened bundle variants
   * @returns Discount amount and snapshot
   */
  async applyDiscountsToOrder(
    cartId: string,
    checkoutSessionId: string | null,
    effectiveSubtotal: number,
    customerId: string | null,
    userId: string | null,
    discountCode: string | null,
    shippingCost: number,
    cartItemsForEngine: Array<{
      id: string;
      productVariantId: string;
      productId: string;
      categoryId: string | null;
      collectionIds: string[];
      tagIds: string[];
      price: number;
      quantity: number;
    }>,
    bundleCartItems: Array<{
      id: string;
      quantity: number;
      metadata: unknown;
    }>,
    bundleVariantMapping: Map<string, string[]>,
    flattenedBundleVariants: Array<{
      variantId: string;
      productId: string;
      categoryId: string | null;
      bundleLineId?: string;
      basePrice: number;
      quantity: number;
    }>,
  ): Promise<{
    discountAmount: number;
    discountSnapshot: DiscountSnapshot | null;
  }> {
    let discountAmount = 0;
    let discountSnapshot: DiscountSnapshot | null = null;

    try {
      // Get eligible discounts (use effective subtotal from pricing engine)
      const eligibleDiscounts =
        await this.discountsService.getEligibleDiscounts(
          effectiveSubtotal,
          customerId || null,
          userId || undefined,
          discountCode || undefined,
        );

      if (eligibleDiscounts.length > 0) {
        // Prepare customer data for engine
        let customerGroupIds: string[] = [];
        if (customerId) {
          try {
            const [customer] = await this.db
              .select({ customerGroupId: customers.customerGroupId })
              .from(customers)
              .where(eq(customers.id, customerId))
              .limit(1);
            // Convert single customerGroupId to array format expected by discount engine
            if (customer?.customerGroupId) {
              customerGroupIds = [customer.customerGroupId];
            }
          } catch (error) {
            this.logger.warn(
              createErrorContext(
                this.contextService,
                "applyDiscountsToOrder",
                error,
                { customerId },
              ),
              "Failed to fetch customer group IDs, continuing without group discounts",
            );
          }
        }

        const customerData = customerId
          ? {
              id: customerId,
              customerGroupIds,
            }
          : null;

        // Run discount engine with profiling
        const engineStartTime = Date.now();
        const engineInput: DiscountEngineInput = {
          cart: {
            items: cartItemsForEngine,
          },
          customer: customerData,
          discounts: eligibleDiscounts,
          now: new Date(),
          shippingCost, // Pass shipping cost for TOTAL discount calculation
        };

        const engineResult = runDiscountEngine(engineInput);
        const engineRuntime = Date.now() - engineStartTime;
        discountAmount = engineResult.discountTotal;

        // Record profiler metrics
        const rulesetVersion = this.hotReloadWatcher.getCurrentVersion();
        const rulesApplied = engineResult.appliedDiscountIds.length;
        this.discountProfiler.recordEngineRun(
          rulesetVersion,
          engineRuntime,
          rulesApplied,
          true, // Cache hit (using in-memory bundle)
        );

        // Create bundle discount breakdowns
        const bundleDiscountBreakdowns = this.createBundleDiscountBreakdowns(
          bundleCartItems,
          bundleVariantMapping,
          flattenedBundleVariants,
          engineResult,
        );

        // Create snapshot with versioning and integrity metadata
        discountSnapshot = createDiscountSnapshot(
          engineResult,
          eligibleDiscounts,
          rulesetVersion,
          bundleDiscountBreakdowns.length > 0
            ? bundleDiscountBreakdowns
            : undefined,
        );

        // Log discount engine run
        await this.logDiscountEngineRun(
          cartId,
          engineResult,
          eligibleDiscounts,
          checkoutSessionId || "",
        );
      }
    } catch (error) {
      // Discount engine failed, continue without discount
      this.logger.error(
        createErrorContext(this.contextService, "runDiscountEngine", error, {
          checkoutSessionId,
          cartId,
        }),
        "Discount engine error",
      );
      discountAmount = 0;
      discountSnapshot = null;
    }

    return { discountAmount, discountSnapshot };
  }

  /**
   * Validate discount snapshot from checkout metadata
   * Ensures snapshot integrity and bundle availability
   * @param checkoutSessionId - Checkout session ID
   * @param discountSnapshot - Discount snapshot to validate
   * @param snapshotTotal - Total amount for snapshot validation
   * @returns Discount amount and code extracted from snapshot
   */
  async validateDiscountSnapshot(
    checkoutSessionId: string,
    discountSnapshot: DiscountSnapshot,
    snapshotTotal: number,
  ): Promise<{
    discountAmount: number;
    discountCode: string | null;
  }> {
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

    // Validate snapshot integrity
    this.discountSnapshotValidator.validateSnapshot(
      discountSnapshot,
      [],
      snapshotTotal,
    );

    const discountAmount = discountSnapshot.discountTotal;

    // Extract discount code from snapshot
    let discountCode: string | null = null;
    if (discountSnapshot.cartDiscounts.length > 0) {
      discountCode = discountSnapshot.cartDiscounts[0].discountCode;
    } else if (
      discountSnapshot.lineItems.some((item) => item.discounts.length > 0)
    ) {
      const firstDiscount = discountSnapshot.lineItems.find(
        (item) => item.discounts.length > 0,
      );
      discountCode = firstDiscount?.discounts[0].discountCode || null;
    }

    return { discountAmount, discountCode };
  }

  /**
   * Log discount snapshot usage for order creation
   * @param checkoutSessionId - Checkout session ID
   * @param orderId - Order ID
   * @param discountSnapshot - Discount snapshot that was used
   */
  async logDiscountSnapshotUsage(
    checkoutSessionId: string,
    orderId: string,
    discountSnapshot: DiscountSnapshot,
  ): Promise<void> {
    try {
      await this.discountAuditService.logSnapshotUsed(
        checkoutSessionId,
        orderId,
        discountSnapshot,
      );
    } catch (error) {
      // Log but don't throw - audit logging failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "logDiscountSnapshotUsage",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to log discount snapshot usage",
      );
    }
  }

  /**
   * Log discount snapshot creation
   * @param checkoutSessionId - Checkout session ID
   * @param discountSnapshot - Discount snapshot that was created
   */
  async logDiscountSnapshotCreation(
    checkoutSessionId: string,
    discountSnapshot: DiscountSnapshot,
  ): Promise<void> {
    try {
      await this.discountAuditService.logSnapshotCreated(
        checkoutSessionId,
        discountSnapshot,
      );
    } catch (error) {
      // Log but don't throw - audit logging failure shouldn't break checkout
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "logDiscountSnapshotCreation",
          error,
          { checkoutSessionId },
        ),
        "Failed to log discount snapshot creation",
      );
    }
  }

  /**
   * Detect discount drift during payment intent creation
   * @param checkoutSessionId - Checkout session ID
   * @param total - Total amount
   * @param amountInRupees - Amount in rupees
   * @param discountSnapshot - Discount snapshot to check for drift
   */
  async detectDiscountDrift(
    checkoutSessionId: string,
    total: number,
    amountInRupees: number,
    discountSnapshot: DiscountSnapshot,
  ): Promise<void> {
    await this.driftDetector.detectPaymentIntentDrift(
      checkoutSessionId,
      total,
      amountInRupees,
      discountSnapshot,
    );
  }

  /**
   * Create bundle discount breakdowns from engine result
   * @private
   */
  private createBundleDiscountBreakdowns(
    bundleCartItems: Array<{
      id: string;
      quantity: number;
      metadata: unknown;
    }>,
    bundleVariantMapping: Map<string, string[]>,
    flattenedBundleVariants: Array<{
      variantId: string;
      bundleLineId?: string;
      quantity: number;
    }>,
    engineResult: DiscountEngineResult,
  ): Array<{
    bundleId: string;
    bundleLineId: string;
    lineDiscountTotal: number;
    variantDiscounts: Array<{
      variantId: string;
      discountAmount: number;
      quantity: number;
    }>;
  }> {
    const bundleDiscountBreakdowns: Array<{
      bundleId: string;
      bundleLineId: string;
      lineDiscountTotal: number;
      variantDiscounts: Array<{
        variantId: string;
        discountAmount: number;
        quantity: number;
      }>;
    }> = [];

    for (const bundleItem of bundleCartItems) {
      const metadata = bundleItem.metadata as BundleCartItemMetadata;
      const variantIds = bundleVariantMapping.get(bundleItem.id) || [];

      // Find discount results for bundle variants
      const variantDiscounts = variantIds.map((variantId) => {
        const lineItem = engineResult.lineItems.find(
          (li) => li.productVariantId === variantId,
        );
        const variantQuantity =
          flattenedBundleVariants.find(
            (v) =>
              v.variantId === variantId &&
              (v.bundleLineId === bundleItem.id || !v.bundleLineId),
          )?.quantity || 0;

        return {
          variantId,
          discountAmount:
            lineItem?.discounts.reduce((sum, d) => sum + d.discountAmount, 0) ||
            0,
          quantity: variantQuantity,
        };
      });

      const lineDiscountTotal = variantDiscounts.reduce(
        (sum, vd) => sum + vd.discountAmount * vd.quantity,
        0,
      );

      bundleDiscountBreakdowns.push({
        bundleId: metadata.bundleId,
        bundleLineId: bundleItem.id,
        lineDiscountTotal,
        variantDiscounts,
      });
    }

    return bundleDiscountBreakdowns;
  }

  /**
   * Log discount engine run for audit
   * @private
   */
  private async logDiscountEngineRun(
    cartId: string,
    engineResult: DiscountEngineResult,
    eligibleDiscounts: DiscountResponseDto[],
    checkoutSessionId: string,
  ): Promise<void> {
    try {
      await this.discountAuditService.logEngineRun(
        cartId,
        engineResult,
        eligibleDiscounts,
      );
    } catch (error) {
      // Log but don't throw - audit logging failure shouldn't break checkout
      this.logger.warn(
        createErrorContext(this.contextService, "logDiscountEngineRun", error, {
          checkoutSessionId,
          cartId,
        }),
        "Failed to log discount engine run",
      );
    }
  }
}
