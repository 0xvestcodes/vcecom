import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq, productAssociations, products, sql } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

export interface ProductAssociationDto {
  productId: string;
  associatedProductId: string;
  frequencyCount: number;
  confidenceScore: number | null;
}

@Injectable()
export class ProductAssociationsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Get frequently bought together products for a given product
   */
  async getFrequentlyBoughtTogether(
    productId: string,
    limit: number = 4,
  ): Promise<Array<{ productId: string; confidenceScore: number }>> {
    try {
      // Verify product exists
      const [product] = await this.db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Get associations ordered by confidence score
      const associations = await this.db
        .select({
          productId: productAssociations.associatedProductId,
          confidenceScore: productAssociations.confidenceScore,
        })
        .from(productAssociations)
        .where(eq(productAssociations.productId, productId))
        .orderBy(desc(productAssociations.confidenceScore))
        .limit(limit);

      return associations.map((a) => ({
        productId: a.productId,
        confidenceScore: a.confidenceScore || 0,
      }));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getFrequentlyBoughtTogether",
          error,
          { productId },
        ),
        "Failed to get frequently bought together products",
      );
      throw error;
    }
  }

  /**
   * Get association statistics
   */
  async getStatistics(): Promise<{
    totalAssociations: number;
    averageConfidence: number;
    productsWithAssociations: number;
  }> {
    try {
      const [stats] = await this.db
        .select({
          totalAssociations: sql<number>`COUNT(*)::int`,
          averageConfidence: sql<number>`AVG(${productAssociations.confidenceScore})`,
          productsWithAssociations: sql<number>`COUNT(DISTINCT ${productAssociations.productId})::int`,
        })
        .from(productAssociations);

      return {
        totalAssociations: stats.totalAssociations || 0,
        averageConfidence: Number(stats.averageConfidence) || 0,
        productsWithAssociations: stats.productsWithAssociations || 0,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getStatistics", error),
        "Failed to get association statistics",
      );
      throw error;
    }
  }

  /**
   * Upsert product association
   */
  async upsertAssociation(
    productId: string,
    associatedProductId: string,
    frequencyCount: number,
    confidenceScore: number | null,
  ): Promise<void> {
    try {
      await this.db
        .insert(productAssociations)
        .values({
          productId,
          associatedProductId,
          frequencyCount,
          confidenceScore,
          lastUpdated: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            productAssociations.productId,
            productAssociations.associatedProductId,
          ],
          set: {
            frequencyCount,
            confidenceScore,
            lastUpdated: new Date(),
          },
        });
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "upsertAssociation", error, {
          productId,
          associatedProductId,
        }),
        "Failed to upsert product association",
      );
      throw error;
    }
  }

  /**
   * Clear all associations (for re-analysis)
   */
  async clearAllAssociations(): Promise<void> {
    try {
      await this.db.delete(productAssociations);
      this.logger.info(
        createLogContext(this.contextService, "clearAllAssociations", {}),
        "Cleared all product associations",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "clearAllAssociations", error),
        "Failed to clear product associations",
      );
      throw error;
    }
  }
}
