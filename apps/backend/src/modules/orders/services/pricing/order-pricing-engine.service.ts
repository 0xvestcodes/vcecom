import { Inject, Injectable } from "@nestjs/common";
import { inArray, productVariants } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { createErrorContext } from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import type { Database } from "../../../../modules/database/db";
import { BundleCartItemMetadata } from "../../../carts/dto/bundle-cart-item.dto";
import { DB_TOKEN } from "../../../database/database.module";
import { runPricingEngine } from "../../../pricing/engine/pricing-engine";
import {
  PricingEngineInput,
  PricingSnapshot,
} from "../../../pricing/engine/pricing-engine.types";
import { createPricingSnapshot } from "../../../pricing/engine/pricing-snapshot.utils";
import { BundlePricingService } from "../../../pricing/services/bundle-pricing.service";
import { PricingAuditService } from "../../../pricing/services/pricing-audit.service";
import { PricingHotReloadWatcher } from "../../../pricing/services/pricing-hot-reload-watcher.service";
import { OrderValidationService } from "../validation/order-validation.service";
import { OrderPricingService } from "./order-pricing.service";

/**
 * Service responsible for pricing engine integration
 * Handles pricing engine execution, snapshot creation, and bundle breakdowns
 */
@Injectable()
export class OrderPricingEngineService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly validationService: OrderValidationService,
    private readonly pricingService: OrderPricingService,
    private readonly bundlePricingService: BundlePricingService,
    private readonly pricingHotReloadWatcher: PricingHotReloadWatcher,
    private readonly pricingAuditService: PricingAuditService,
    @Inject(DB_TOKEN) readonly _db: Database,
  ) {}

  /**
   * Run pricing engine and create pricing snapshot
   */
  @Trace({ operation: "OrderPricingEngineService.runPricingEngine" })
  async runPricingEngine(
    checkoutSessionId: string | null,
    cartId: string,
    customerId: string | null,
    cartItemsWithVariants: Array<{
      cartItemId: string;
      productVariantId: string;
      quantity: number;
      price: number;
      productGstRate: number;
    }>,
    bundleCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>,
    flattenedBundleVariants: Array<{
      variantId: string;
      productId: string;
      categoryId: string | null;
      basePrice: number;
      quantity: number;
      bundleLineId: string;
    }>,
    variantToProductForPricing: Map<string, string>,
    productMapForPricing: Map<
      string,
      {
        productId: string;
        categoryId: string | null;
      }
    >,
    baseSubtotal: number,
  ): Promise<{
    pricingSnapshot: PricingSnapshot | null;
    effectiveSubtotal: number;
  }> {
    let pricingSnapshot: PricingSnapshot | null = null;
    let effectiveSubtotal = baseSubtotal; // Default to base subtotal

    try {
      // Get customer group for price list resolution
      const customerGroupId = customerId
        ? await this.validationService.getCustomerGroupId(customerId)
        : null;

      // Get active price lists for customer group
      const activePriceLists =
        await this.pricingService.getPriceListsForCustomer(customerGroupId);

      // Fetch variant pricing data (compareAtPrice, salePrice, etc.)
      const variantIds = [
        ...cartItemsWithVariants.map((item) => item.productVariantId),
        ...flattenedBundleVariants.map((v) => v.variantId),
      ];
      const variantPricingMap = new Map<
        string,
        {
          compareAtPrice: number | null;
          salePrice: number | null;
          saleStartDate: Date | null;
          saleEndDate: Date | null;
        }
      >();

      if (variantIds.length > 0) {
        const variants = await this._db
          .select({
            id: productVariants.id,
            compareAtPrice: productVariants.compareAtPrice,
            salePrice: productVariants.salePrice,
            saleStartDate: productVariants.saleStartDate,
            saleEndDate: productVariants.saleEndDate,
          })
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds));

        for (const variant of variants) {
          variantPricingMap.set(variant.id, {
            compareAtPrice: variant.compareAtPrice,
            salePrice: variant.salePrice,
            saleStartDate: variant.saleStartDate,
            saleEndDate: variant.saleEndDate,
          });
        }
      }

      // Build variant pricing input (variants + flattened bundles)
      const variantPricingInput = [
        ...cartItemsWithVariants.map((item) => {
          const productId = variantToProductForPricing.get(
            item.productVariantId,
          );
          const product = productId
            ? productMapForPricing.get(productId)
            : null;
          const variantPricing = variantPricingMap.get(item.productVariantId);
          return {
            variantId: item.productVariantId,
            productId: productId || "",
            categoryId: product?.categoryId || null,
            basePrice: item.price,
            compareAtPrice: variantPricing?.compareAtPrice || undefined,
            salePrice: variantPricing?.salePrice || undefined,
            saleStartDate: variantPricing?.saleStartDate || undefined,
            saleEndDate: variantPricing?.saleEndDate || undefined,
          };
        }),
        ...flattenedBundleVariants.map((v) => {
          const variantPricing = variantPricingMap.get(v.variantId);
          return {
            variantId: v.variantId,
            productId: v.productId,
            categoryId: v.categoryId,
            basePrice: v.basePrice,
            compareAtPrice: variantPricing?.compareAtPrice || undefined,
            salePrice: variantPricing?.salePrice || undefined,
            saleStartDate: variantPricing?.saleStartDate || undefined,
            saleEndDate: variantPricing?.saleEndDate || undefined,
          };
        }),
      ];

      // Run pricing engine
      const pricingInput: PricingEngineInput = {
        variants: variantPricingInput,
        customer: customerId
          ? {
              id: customerId,
              customerGroupId,
            }
          : null,
        priceLists: activePriceLists,
        now: new Date(),
      };

      const pricingResult = runPricingEngine(pricingInput);
      effectiveSubtotal = pricingResult.totalEffectivePrice;

      // Create bundle breakdowns for pricing snapshot
      const bundlePricingBreakdowns: Array<{
        bundleId: string;
        bundleLineId: string;
        unitBundlePrice: number;
        variantBreakdown: Array<{
          variantId: string;
          unitPrice: number;
          quantity: number;
        }>;
      }> = [];

      for (const bundleItem of bundleCartItems) {
        const metadata = bundleItem.metadata as BundleCartItemMetadata;
        const variantQuantities =
          this.bundlePricingService.flattenBundleSelections(
            metadata.selections,
            1, // unit quantity for breakdown
          );

        const variantBreakdown = variantQuantities.map((vq) => {
          const pricingResultItem = pricingResult.variantPrices.find(
            (vp) => vp.variantId === vq.variantId,
          );
          return {
            variantId: vq.variantId,
            unitPrice: pricingResultItem?.effectivePrice || vq.quantity,
            quantity: vq.quantity,
          };
        });

        bundlePricingBreakdowns.push({
          bundleId: metadata.bundleId,
          bundleLineId: bundleItem.id,
          unitBundlePrice: bundleItem.price,
          variantBreakdown,
        });
      }

      // Create pricing snapshot
      const rulesetVersion = this.pricingHotReloadWatcher.getCurrentVersion();
      pricingSnapshot = createPricingSnapshot(
        pricingResult,
        activePriceLists,
        rulesetVersion,
        bundlePricingBreakdowns.length > 0
          ? bundlePricingBreakdowns
          : undefined,
      );

      // Log pricing engine run
      try {
        await this.pricingAuditService.logEngineRun(
          checkoutSessionId || "",
          pricingResult,
          rulesetVersion,
        );
      } catch (error) {
        // Log but don't throw - audit logging failure shouldn't break checkout
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "logPricingEngineRun",
            error,
            { checkoutSessionId },
          ),
          "Failed to log pricing engine run",
        );
      }

      // Log snapshot creation
      try {
        await this.pricingAuditService.logSnapshotCreated(
          checkoutSessionId || "",
          pricingSnapshot,
        );
      } catch (error) {
        // Log but don't throw - audit logging failure shouldn't break checkout
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "logPricingSnapshotCreation",
            error,
            { checkoutSessionId },
          ),
          "Failed to log pricing snapshot creation",
        );
      }
    } catch (error) {
      // Pricing engine failed, continue with base prices
      this.logger.error(
        createErrorContext(this.contextService, "runPricingEngine", error, {
          checkoutSessionId,
          cartId,
        }),
        "Pricing engine error",
      );
      pricingSnapshot = null;
    }

    return {
      pricingSnapshot,
      effectiveSubtotal,
    };
  }
}
