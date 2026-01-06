import { Inject, Injectable } from "@nestjs/common";
import {
  customerGroups,
  customers,
  eq,
  inArray,
  products,
  productVariants,
  taxExemptions,
  taxRules,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { runTaxEngine } from "../engine/tax-engine";
import type {
  TaxEngineInput,
  TaxEngineResult,
  TaxExemptionInput,
  TaxRuleInput,
  VariantTaxInput,
} from "../engine/tax-engine.types";

/**
 * Service for resolving tax rules and exemptions, and running tax engine
 */
@Injectable()
export class TaxResolutionService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Fetch active tax rules for given context
   */
  async fetchTaxRules(now: Date): Promise<TaxRuleInput[]> {
    try {
      // Fetch all active rules, then filter by date in memory
      // This is simpler than complex SQL date filtering with nulls
      const allRules = await this.db
        .select()
        .from(taxRules)
        .where(eq(taxRules.isActive, 1));

      // Filter by date range
      const rules = allRules.filter((rule) => {
        if (rule.startDate && new Date(rule.startDate) > now) {
          return false;
        }
        if (rule.endDate && new Date(rule.endDate) < now) {
          return false;
        }
        return true;
      });

      return rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        ruleType: rule.ruleType as TaxRuleInput["ruleType"],
        entityId: rule.entityId,
        gstRate: Number(rule.gstRate),
        priority: rule.priority,
        isActive: rule.isActive === 1,
        startDate: rule.startDate ? new Date(rule.startDate) : undefined,
        endDate: rule.endDate ? new Date(rule.endDate) : undefined,
      }));
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "fetchTaxRules", error),
        "Failed to fetch tax rules",
      );
      return [];
    }
  }

  /**
   * Fetch active tax exemptions for given context
   */
  async fetchTaxExemptions(now: Date): Promise<TaxExemptionInput[]> {
    try {
      // Fetch all active exemptions, then filter by date in memory
      const allExemptions = await this.db
        .select()
        .from(taxExemptions)
        .where(eq(taxExemptions.isActive, 1));

      // Filter by date range
      const exemptions = allExemptions.filter((exemption) => {
        if (exemption.startDate && new Date(exemption.startDate) > now) {
          return false;
        }
        if (exemption.endDate && new Date(exemption.endDate) < now) {
          return false;
        }
        return true;
      });

      return exemptions.map((exemption) => ({
        id: exemption.id,
        name: exemption.name,
        exemptionType:
          exemption.exemptionType as TaxExemptionInput["exemptionType"],
        entityId: exemption.entityId,
        exemptionReason: exemption.exemptionReason || undefined,
        certificateNumber: exemption.certificateNumber || undefined,
        isActive: exemption.isActive === 1,
        startDate: exemption.startDate
          ? new Date(exemption.startDate)
          : undefined,
        endDate: exemption.endDate ? new Date(exemption.endDate) : undefined,
      }));
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "fetchTaxExemptions", error),
        "Failed to fetch tax exemptions",
      );
      return [];
    }
  }

  /**
   * Fetch customer group with tax display type
   */
  async fetchCustomerGroup(
    customerGroupId: string | null,
  ): Promise<{ id: string; taxDisplayType: "INCLUSIVE" | "EXCLUSIVE" } | null> {
    if (!customerGroupId) {
      return null;
    }

    try {
      const [group] = await this.db
        .select({
          id: customerGroups.id,
          taxDisplayType: customerGroups.taxDisplayType,
        })
        .from(customerGroups)
        .where(eq(customerGroups.id, customerGroupId))
        .limit(1);

      if (!group) {
        return null;
      }

      return {
        id: group.id,
        taxDisplayType: group.taxDisplayType as "INCLUSIVE" | "EXCLUSIVE",
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "fetchCustomerGroup", error),
        "Failed to fetch customer group",
      );
      return null;
    }
  }

  /**
   * Fetch customer information for tax calculation
   */
  async fetchCustomerForTax(customerId: string | null): Promise<{
    id: string;
    customerGroupId: string | null;
    gstin?: string;
  } | null> {
    if (!customerId) {
      return null;
    }

    try {
      const [customer] = await this.db
        .select({
          id: customers.id,
          customerGroupId: customers.customerGroupId,
          gstin: customers.gstin,
        })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer) {
        return null;
      }

      return {
        id: customer.id,
        customerGroupId: customer.customerGroupId,
        gstin: customer.gstin || undefined,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "fetchCustomerForTax", error),
        "Failed to fetch customer for tax",
      );
      return null;
    }
  }

  /**
   * Build variant tax input from variant IDs
   */
  async buildVariantTaxInputs(
    variantIds: string[],
  ): Promise<VariantTaxInput[]> {
    if (variantIds.length === 0) {
      return [];
    }

    try {
      const variants = await this.db
        .select({
          variantId: productVariants.id,
          productId: productVariants.productId,
          price: productVariants.price,
          product: {
            id: products.id,
            categoryId: products.categoryId,
            gstRate: products.gstRate,
            hsnCode: products.hsnCode,
          },
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(inArray(productVariants.id, variantIds));

      return variants.map((v) => ({
        variantId: v.variantId,
        productId: v.product.id,
        categoryId: v.product.categoryId,
        hsnCode: v.product.hsnCode || undefined,
        baseGstRate: Number(v.product.gstRate),
        baseAmount: Number(v.price),
        quantity: 1, // Would be provided from cart/order context
      }));
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "buildVariantTaxInputs", error),
        "Failed to build variant tax inputs",
      );
      return [];
    }
  }

  /**
   * Resolve tax for variants
   */
  async resolveTax(input: {
    variants: VariantTaxInput[];
    customerId: string | null;
    sellerState: string;
    buyerState: string;
    now?: Date;
  }): Promise<TaxEngineResult> {
    const {
      variants,
      customerId,
      sellerState,
      buyerState,
      now = new Date(),
    } = input;

    // Fetch customer information
    const customer = await this.fetchCustomerForTax(customerId);
    const customerGroup = await this.fetchCustomerGroup(
      customer?.customerGroupId || null,
    );

    // Fetch tax rules and exemptions
    const taxRules = await this.fetchTaxRules(now);
    const taxExemptions = await this.fetchTaxExemptions(now);

    // Build tax engine input
    const taxEngineInput: TaxEngineInput = {
      variants,
      customer: customer
        ? {
            id: customer.id,
            customerGroupId: customer.customerGroupId,
            gstin: customer.gstin,
          }
        : null,
      customerGroup: customerGroup || undefined,
      sellerState,
      buyerState,
      taxRules,
      taxExemptions,
      now,
    };

    // Run tax engine
    return runTaxEngine(taxEngineInput);
  }
}
