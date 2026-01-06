import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { createErrorContext } from "../../../../common/logging/logging.helper";
import { runPricingEngine } from "../../../pricing/engine/pricing-engine";
import {
  PriceList,
  PricingEngineInput,
  PricingSnapshot,
} from "../../../pricing/engine/pricing-engine.types";
import { createPricingSnapshot } from "../../../pricing/engine/pricing-snapshot.utils";
import { CustomerGroupService } from "../../../pricing/services/customer-group.service";
import { PriceListService } from "../../../pricing/services/price-list.service";
import { PricingSnapshotValidator } from "../../../pricing/services/pricing-snapshot-validator.service";

/**
 * Service responsible for order pricing calculations
 * Handles price list resolution and pricing engine execution
 */
@Injectable()
export class OrderPricingService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly priceListService: PriceListService,
    private readonly customerGroupService: CustomerGroupService,
    private readonly pricingSnapshotValidator: PricingSnapshotValidator,
  ) {}

  /**
   * Get price lists for a customer based on customer group
   * @param customerGroupId - Customer group ID (can be null)
   * @returns Array of active price lists applicable to the customer group
   */
  async getPriceListsForCustomer(customerGroupId: string | null): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      priority: number;
      isActive: boolean;
      startDate?: Date;
      endDate?: Date;
      items: Array<{
        id: string;
        productVariantId?: string;
        productId?: string;
        categoryId?: string;
        overrideType: "FIXED" | "PERCENTAGE";
        overrideValue: number;
      }>;
    }>
  > {
    try {
      if (!customerGroupId) {
        return [];
      }

      const group = await this.customerGroupService.findOne(customerGroupId);
      const priceListIds = group.priceLists.map((pl) => pl.priceListId);

      if (priceListIds.length === 0) {
        return [];
      }

      const priceLists = await Promise.all(
        priceListIds.map((id) => this.priceListService.findOne(id)),
      );

      // Convert to PricingEngineInput format
      return priceLists.map((list) => ({
        id: list.id,
        name: list.name,
        type: list.type,
        priority: list.priority,
        isActive: list.isActive,
        startDate: list.startDate || undefined,
        endDate: list.endDate || undefined,
        currency: list.currency || undefined,
        items: list.items.map((item) => ({
          id: item.id,
          productVariantId: item.productVariantId || undefined,
          productId: item.productId || undefined,
          categoryId: item.categoryId || undefined,
          currency: item.currency || undefined,
          overrideType: item.overrideType as "FIXED" | "PERCENTAGE",
          overrideValue: item.overrideValue,
        })),
      }));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getPriceListsForCustomer",
          error,
          { customerGroupId },
        ),
        "Failed to get price lists for customer group",
      );
      return [];
    }
  }

  /**
   * Run pricing engine for order items
   * @param pricingInput - Pricing engine input
   * @returns Pricing engine result with effective prices
   */
  async calculatePrices(pricingInput: PricingEngineInput) {
    try {
      return runPricingEngine(pricingInput);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "runPricingEngine", error, {
          variantCount: pricingInput.variants.length,
        }),
        "Failed to run pricing engine",
      );
      throw error;
    }
  }

  /**
   * Create pricing snapshot for order
   * @param pricingResult - Result from pricing engine
   * @param appliedPriceLists - Price lists that were applied
   * @param rulesetVersion - Current pricing ruleset version
   * @param bundleBreakdowns - Optional bundle pricing breakdowns
   * @returns Pricing snapshot
   */
  createPricingSnapshot(
    pricingResult: ReturnType<typeof runPricingEngine>,
    appliedPriceLists: PriceList[],
    rulesetVersion: number,
    bundleBreakdowns?: Array<{
      bundleId: string;
      bundleLineId: string;
      unitBundlePrice: number;
      variantBreakdown: Array<{
        variantId: string;
        unitPrice: number;
        quantity: number;
      }>;
    }>,
  ) {
    return createPricingSnapshot(
      pricingResult,
      appliedPriceLists,
      rulesetVersion,
      bundleBreakdowns,
    );
  }

  /**
   * Validate pricing snapshot
   * @param snapshot - Pricing snapshot to validate
   * @returns void (throws BadRequestException if invalid)
   */
  validatePricingSnapshot(snapshot: PricingSnapshot): void {
    this.pricingSnapshotValidator.validate(snapshot);
  }
}
