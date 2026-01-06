import { Inject, Injectable } from "@nestjs/common";
import { eq, productVariants } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { InventoryStore } from "../../redis-store/stores/inventory-store";
import { InventoryValidator } from "../validators/inventory-validator";

export interface ProcessResult {
  success: boolean;
  variantId?: string;
  error?: string;
}

@Injectable()
export class InventoryProcessor {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly validator: InventoryValidator,
    private readonly inventoryStore: InventoryStore,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Process a single inventory import row
   */
  async process(
    row: Record<string, string>,
    options?: {
      skipErrors?: boolean;
    },
  ): Promise<ProcessResult> {
    try {
      // Validate row data
      const validation = this.validator.validate(row);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.map((e) => e.errorMessage).join("; "),
        };
      }

      if (!validation.data) {
        return {
          success: false,
          error: "Validation data is missing",
        };
      }

      const data = validation.data;

      // Find variant by SKU
      const [variant] = await this.db
        .select()
        .from(productVariants)
        .where(eq(productVariants.sku, data.sku))
        .limit(1);

      if (!variant) {
        return {
          success: false,
          error: `Product variant with SKU "${data.sku}" not found`,
        };
      }

      // Get current inventory
      const currentInventory =
        (await this.inventoryStore.getAvailableInventory(variant.id)) ?? 0;

      // Calculate new quantity based on adjustment type
      let newQuantity: number;
      const adjustmentType = data.adjustmentType || "set";

      switch (adjustmentType) {
        case "increase":
          newQuantity = currentInventory + data.quantity;
          break;
        case "decrease":
          newQuantity = Math.max(0, currentInventory - data.quantity);
          break;
        default:
          newQuantity = data.quantity;
          break;
      }

      if (newQuantity < 0) {
        return {
          success: false,
          error: "Inventory cannot be negative",
        };
      }

      // Set inventory in Redis (source of truth)
      await this.inventoryStore.setInventory(variant.id, newQuantity);

      // Update database for consistency
      await this.db
        .update(productVariants)
        .set({
          inventory: newQuantity,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, variant.id));

      return {
        success: true,
        variantId: variant.id,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "process", error, { row }),
        "Failed to process inventory import row",
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
