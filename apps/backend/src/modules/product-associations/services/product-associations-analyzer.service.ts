import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, orderItems, orders, productVariants, sql } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { ProductAssociationsService } from "./product-associations.service";

/**
 * Product Associations Analyzer
 * Analyzes order history to build frequently bought together associations
 */
@Injectable()
export class ProductAssociationsAnalyzer implements OnModuleInit {
  private readonly MIN_CO_OCCURRENCES = 3; // Minimum times products must appear together
  private readonly MIN_CONFIDENCE = 0.3; // Minimum confidence score (0-1)
  private readonly ANALYSIS_DAYS = 90; // Analyze last 90 days of orders

  constructor(
    private readonly associationsService: ProductAssociationsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  async onModuleInit() {
    this.logger.info(
      createLogContext(this.contextService, "onModuleInit", {}),
      "Product associations analyzer initialized",
    );
  }

  /**
   * Daily analysis of order history
   * Runs at 2 AM daily
   */
  @Cron("0 2 * * *")
  async analyzeOrderHistory() {
    this.logger.info(
      createLogContext(this.contextService, "analyzeOrderHistory", {}),
      "Starting product associations analysis",
    );

    try {
      await this.runAnalysis();
      this.logger.info(
        createLogContext(this.contextService, "analyzeOrderHistory", {}),
        "Product associations analysis completed",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "analyzeOrderHistory", error),
        "Failed to analyze product associations",
      );
      // Don't throw - analysis failures shouldn't break the app
    }
  }

  /**
   * Run analysis on order history
   */
  async runAnalysis(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.ANALYSIS_DAYS);

    // Get all completed orders from the last 90 days
    const completedOrders = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.status, "delivered"),
          sql`${orders.createdAt} >= ${cutoffDate}`,
        ),
      );

    this.logger.debug(
      createLogContext(this.contextService, "runAnalysis", {
        orderCount: completedOrders.length,
      }),
      "Found completed orders for analysis",
    );

    // Build product co-occurrence map
    const coOccurrenceMap = new Map<string, Map<string, number>>();

    for (const order of completedOrders) {
      // Get all product IDs from this order (via variants)
      const items = await this.db
        .select({
          productId: productVariants.productId,
        })
        .from(orderItems)
        .innerJoin(
          productVariants,
          eq(orderItems.productVariantId, productVariants.id),
        )
        .where(eq(orderItems.orderId, order.id));

      const productIds = Array.from(
        new Set(items.map((item) => item.productId)),
      );

      // Count co-occurrences for all pairs in this order
      for (let i = 0; i < productIds.length; i++) {
        for (let j = i + 1; j < productIds.length; j++) {
          const productA = productIds[i];
          const productB = productIds[j];

          // Count A -> B
          if (!coOccurrenceMap.has(productA)) {
            coOccurrenceMap.set(productA, new Map());
          }
          const productAMap = coOccurrenceMap.get(productA);
          if (productAMap) {
            productAMap.set(productB, (productAMap.get(productB) || 0) + 1);
          }

          // Count B -> A (bidirectional)
          if (!coOccurrenceMap.has(productB)) {
            coOccurrenceMap.set(productB, new Map());
          }
          const productBMap = coOccurrenceMap.get(productB);
          if (productBMap) {
            productBMap.set(productA, (productBMap.get(productA) || 0) + 1);
          }
        }
      }
    }

    // Calculate confidence scores and store associations
    let associationsCreated = 0;

    // Get total order counts per product for confidence calculation
    const productOrderCounts = new Map<string, number>();
    for (const order of completedOrders) {
      const items = await this.db
        .select({
          productId: productVariants.productId,
        })
        .from(orderItems)
        .innerJoin(
          productVariants,
          eq(orderItems.productVariantId, productVariants.id),
        )
        .where(eq(orderItems.orderId, order.id));

      const productIds = new Set(items.map((item) => item.productId));
      for (const productId of productIds) {
        productOrderCounts.set(
          productId,
          (productOrderCounts.get(productId) || 0) + 1,
        );
      }
    }

    // Calculate confidence and store associations
    for (const [productId, associatedProducts] of coOccurrenceMap.entries()) {
      const productOrderCount = productOrderCounts.get(productId) || 1;

      for (const [
        associatedProductId,
        frequency,
      ] of associatedProducts.entries()) {
        // Only store if meets minimum thresholds
        if (frequency >= this.MIN_CO_OCCURRENCES) {
          const confidence = frequency / productOrderCount;

          if (confidence >= this.MIN_CONFIDENCE) {
            await this.associationsService.upsertAssociation(
              productId,
              associatedProductId,
              frequency,
              confidence,
            );
            associationsCreated++;
          }
        }
      }
    }

    this.logger.info(
      createLogContext(this.contextService, "runAnalysis", {
        associationsCreated,
        totalProducts: coOccurrenceMap.size,
      }),
      "Product associations analysis completed",
    );
  }
}
