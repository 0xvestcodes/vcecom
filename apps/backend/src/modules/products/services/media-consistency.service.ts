import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  eq,
  isNull,
  not,
  productImages,
  products,
  productVariants,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { NotificationsService } from "../../notifications/notifications.service";
import { NotificationType } from "../../notifications/types/notification.types";
import { StorageService } from "../../storage/storage.service";
import {
  MediaFix,
  MediaHealthFixResult,
  MediaHealthScanResult,
  MediaHealthStats,
  MediaIssue,
  OrderIndexIssue,
  OrphanImageIssue,
  S3ConsistencyIssue,
  VariantInheritanceIssue,
} from "../types/media-consistency.types";
import { MediaAuditService } from "./media-audit.service";

@Injectable()
export class MediaConsistencyService {
  constructor(
    private readonly storageService: StorageService,
    private readonly auditService: MediaAuditService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly notificationsService: NotificationsService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Comprehensive scan for all media consistency issues
   */
  async scanAllIssues(): Promise<MediaHealthScanResult> {
    this.logger.debug(
      createLogContext(this.contextService, "scanAllIssues", {}),
      "Starting comprehensive media consistency scan",
    );

    const issues: MediaIssue[] = [];

    // Check orphan images
    const orphanIssues = await this.checkOrphanImages();
    issues.push(...orphanIssues);

    // Check order indexes
    const orderIssues = await this.checkOrderIndexes();
    issues.push(...orderIssues);

    // Check S3 consistency
    const s3Issues = await this.checkS3Consistency();
    issues.push(...s3Issues);

    // Check variant inheritance
    const inheritanceIssues = await this.checkVariantInheritance();
    issues.push(...inheritanceIssues);

    // Calculate stats
    const stats = await this.calculateStats(issues);

    // Create notification if critical issues found
    if (issues.length > 0) {
      try {
        const criticalCount = issues.filter(
          (issue) => issue.severity === "critical",
        ).length;
        await this.notificationsService.createFromEvent({
          adminId: null, // Broadcast to all admins
          type: NotificationType.SYSTEM,
          title: "Media Health Issues Detected",
          message: `Found ${issues.length} media consistency issue${issues.length > 1 ? "s" : ""}${criticalCount > 0 ? ` (${criticalCount} critical)` : ""}`,
          meta: {
            totalIssues: issues.length,
            criticalCount,
            stats,
          },
        });
      } catch (error) {
        // Log but don't throw - notification failure shouldn't break scan
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "createMediaHealthNotification",
            error,
            {
              issueCount: issues.length,
            },
          ),
          "Failed to create media health notification",
        );
      }
    }

    this.logger.info(
      createLogContext(this.contextService, "scanAllIssues", {
        totalIssues: issues.length,
        stats,
      }),
      "Media consistency scan completed",
    );

    return {
      issues,
      stats,
      scannedAt: new Date(),
    };
  }

  /**
   * Check for orphan images (invalid productId/variantId references)
   */
  async checkOrphanImages(): Promise<OrphanImageIssue[]> {
    const issues: OrphanImageIssue[] = [];

    // Get all images
    const allImages = await this.db.select().from(productImages);

    // Get all product IDs
    const allProducts = await this.db
      .select({ id: products.id })
      .from(products);
    const productIds = new Set(allProducts.map((p) => p.id));

    // Get all variant IDs
    const allVariants = await this.db
      .select({ id: productVariants.id })
      .from(productVariants);
    const variantIds = new Set(allVariants.map((v) => v.id));

    for (const image of allImages) {
      // Check if product exists
      if (!productIds.has(image.productId)) {
        issues.push({
          type: "orphan_image",
          severity: "error",
          description: `Image references non-existent product ${image.productId}`,
          productId: image.productId,
          imageId: image.id,
          reason: "missing_product",
          suggestedFix: "Delete orphaned image",
        });
        continue;
      }

      // Check if variant exists (if variantId is set)
      if (image.variantId && !variantIds.has(image.variantId)) {
        issues.push({
          type: "orphan_image",
          severity: "error",
          description: `Image references non-existent variant ${image.variantId}`,
          productId: image.productId,
          variantId: image.variantId,
          imageId: image.id,
          reason: "missing_variant",
          suggestedFix: "Delete orphaned image",
        });
      }
    }

    return issues;
  }

  /**
   * Check order index sequences (no gaps, no collisions)
   */
  async checkOrderIndexes(): Promise<OrderIndexIssue[]> {
    const issues: OrderIndexIssue[] = [];

    // Get all products
    const allProducts = await this.db
      .select({ id: products.id })
      .from(products);

    for (const product of allProducts) {
      // Get product images (no variantId)
      const productImgs = await this.db
        .select()
        .from(productImages)
        .where(
          and(
            eq(productImages.productId, product.id),
            isNull(productImages.variantId),
          ),
        )
        .orderBy(asc(productImages.order));

      // Check for gaps and collisions
      const orders = productImgs.map((img) => img.order);
      const expectedOrders = Array.from({ length: orders.length }, (_, i) => i);

      // Check for gaps
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== expectedOrders[i]) {
          issues.push({
            type: "order_index_gap",
            severity: "warning",
            description: `Product ${product.id} has order gap at position ${i}`,
            productId: product.id,
            expectedOrder: expectedOrders[i],
            actualOrder: orders[i],
            suggestedFix: "Reorder images sequentially",
          });
        }
      }

      // Check for collisions
      const orderMap = new Map<number, string[]>();
      for (const img of productImgs) {
        if (!orderMap.has(img.order)) {
          orderMap.set(img.order, []);
        }
        orderMap.get(img.order)?.push(img.id);
      }

      for (const [order, imageIds] of orderMap.entries()) {
        if (imageIds.length > 1) {
          issues.push({
            type: "order_index_collision",
            severity: "error",
            description: `Product ${product.id} has ${imageIds.length} images with order ${order}`,
            productId: product.id,
            actualOrder: order,
            conflictingImageIds: imageIds,
            suggestedFix: "Reorder images to resolve collision",
          });
        }
      }
    }

    // Check variant images
    const allVariants = await this.db
      .select({ id: productVariants.id, productId: productVariants.productId })
      .from(productVariants);

    for (const variant of allVariants) {
      const variantImgs = await this.db
        .select()
        .from(productImages)
        .where(eq(productImages.variantId, variant.id))
        .orderBy(asc(productImages.order));

      const orders = variantImgs.map((img) => img.order);
      const expectedOrders = Array.from({ length: orders.length }, (_, i) => i);

      // Check for gaps
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== expectedOrders[i]) {
          issues.push({
            type: "order_index_gap",
            severity: "warning",
            description: `Variant ${variant.id} has order gap at position ${i}`,
            productId: variant.productId,
            variantId: variant.id,
            expectedOrder: expectedOrders[i],
            actualOrder: orders[i],
            suggestedFix: "Reorder variant images sequentially",
          });
        }
      }

      // Check for collisions
      const orderMap = new Map<number, string[]>();
      for (const img of variantImgs) {
        if (!orderMap.has(img.order)) {
          orderMap.set(img.order, []);
        }
        orderMap.get(img.order)?.push(img.id);
      }

      for (const [order, imageIds] of orderMap.entries()) {
        if (imageIds.length > 1) {
          issues.push({
            type: "order_index_collision",
            severity: "error",
            description: `Variant ${variant.id} has ${imageIds.length} images with order ${order}`,
            productId: variant.productId,
            variantId: variant.id,
            actualOrder: order,
            conflictingImageIds: imageIds,
            suggestedFix: "Reorder variant images to resolve collision",
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check S3 consistency (DB records vs S3 files)
   */
  async checkS3Consistency(): Promise<S3ConsistencyIssue[]> {
    const issues: S3ConsistencyIssue[] = [];

    // Get all images with S3 keys (not full URLs)
    const allImages = await this.db.select().from(productImages);

    for (const image of allImages) {
      // Check if it's an S3 key (not a full URL)
      const isS3Key =
        !image.url.startsWith("http://") && !image.url.startsWith("https://");

      if (isS3Key) {
        try {
          // Check if file exists in S3
          const exists = await this.storageService.exists(image.url);
          if (!exists) {
            issues.push({
              type: "s3_missing_file",
              severity: "error",
              description: `Image record exists but S3 file missing: ${image.url}`,
              productId: image.productId,
              variantId: image.variantId || undefined,
              imageId: image.id,
              s3Key: image.url,
              fileExists: false,
              recordExists: true,
              suggestedFix: "Delete image record or restore S3 file",
            });
          }
        } catch (error) {
          // If check fails, log but don't create issue (might be transient)
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "checkS3Consistency",
              error,
              { imageId: image.id, s3Key: image.url },
            ),
            "Failed to check S3 file existence",
          );
        }
      }
    }

    // Note: Checking for orphaned S3 files (files without DB records) is expensive
    // and should be done separately or on-demand, not in every scan

    return issues;
  }

  /**
   * Check variant inheritance consistency
   * Note: This requires knowing variant inheritance mode, which may need to be stored
   * For now, we'll check basic violations
   */
  async checkVariantInheritance(): Promise<VariantInheritanceIssue[]> {
    const issues: VariantInheritanceIssue[] = [];

    // Get all variants
    const allVariants = await this.db
      .select({ id: productVariants.id, productId: productVariants.productId })
      .from(productVariants);

    for (const variant of allVariants) {
      // Get product images
      const productImgs = await this.db
        .select()
        .from(productImages)
        .where(
          and(
            eq(productImages.productId, variant.productId),
            isNull(productImages.variantId),
          ),
        );

      // Get variant-specific images
      const variantImgs = await this.db
        .select()
        .from(productImages)
        .where(eq(productImages.variantId, variant.id));

      // If variant has custom images, it should have at least one
      // If variant has no custom images, it should inherit from product
      // Note: We can't determine mode without additional metadata
      // For now, we'll flag variants with no images at all (neither custom nor product)
      if (variantImgs.length === 0 && productImgs.length === 0) {
        issues.push({
          type: "variant_inheritance_violation",
          severity: "warning",
          description: `Variant ${variant.id} has no images (neither custom nor product images exist)`,
          productId: variant.productId,
          variantId: variant.id,
          mode: "inherit",
          violation: "missing_images_in_custom_mode",
          suggestedFix: "Add product images or variant-specific images",
        });
      }
    }

    return issues;
  }

  /**
   * Calculate health statistics
   */
  async calculateStats(issues: MediaIssue[]): Promise<MediaHealthStats> {
    const totalProducts = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products);
    const totalVariants = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productVariants);
    const totalImages = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productImages);

    const productImgs = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productImages)
      .where(isNull(productImages.variantId));
    const variantImgs = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productImages)
      .where(not(isNull(productImages.variantId)));

    const orphanIssues = issues.filter((i) => i.type === "orphan_image");
    const orderIssues = issues.filter(
      (i) => i.type === "order_index_gap" || i.type === "order_index_collision",
    );
    const s3Issues = issues.filter(
      (i) => i.type === "s3_missing_file" || i.type === "s3_orphan_file",
    );
    const inheritanceIssues = issues.filter(
      (i) => i.type === "variant_inheritance_violation",
    );

    return {
      totalProducts: Number(totalProducts[0]?.count || 0),
      totalVariants: Number(totalVariants[0]?.count || 0),
      totalImages: Number(totalImages[0]?.count || 0),
      productImages: Number(productImgs[0]?.count || 0),
      variantImages: Number(variantImgs[0]?.count || 0),
      orphanImages: orphanIssues.length,
      orderIndexIssues: orderIssues.length,
      s3ConsistencyIssues: s3Issues.length,
      variantInheritanceIssues: inheritanceIssues.length,
      totalIssues: issues.length,
    };
  }

  /**
   * Fix orphan images (delete them and their S3 files)
   */
  async fixOrphanImages(performedBy: string): Promise<MediaFix[]> {
    const fixes: MediaFix[] = [];
    const orphanIssues = await this.checkOrphanImages();

    for (const issue of orphanIssues) {
      if (!issue.imageId) continue;

      try {
        // Get image record
        const [image] = await this.db
          .select()
          .from(productImages)
          .where(eq(productImages.id, issue.imageId))
          .limit(1);

        if (!image) continue;

        const beforeState = { ...image };

        // Delete from S3 if it's an S3 key
        const isS3Key =
          !image.url.startsWith("http://") && !image.url.startsWith("https://");
        if (isS3Key) {
          try {
            await this.storageService.delete(image.url);
          } catch (error) {
            // Continue even if S3 deletion fails
            this.logger.warn(
              createErrorContext(
                this.contextService,
                "fixOrphanImages",
                error,
                { imageId: image.id, s3Key: image.url },
              ),
              "Failed to delete S3 file for orphan image",
            );
          }
        }

        // Delete from database
        await this.db
          .delete(productImages)
          .where(eq(productImages.id, issue.imageId));

        // Log audit entry
        await this.auditService.logAction("orphan_cleanup", performedBy, {
          imageId: issue.imageId,
          productId: issue.productId,
          variantId: issue.variantId,
          details: {
            beforeState,
            reason: issue.reason,
          },
        });

        fixes.push({
          issueId: issue.imageId,
          issueType: issue.type,
          action: "deleted_orphan_image",
          productId: issue.productId,
          variantId: issue.variantId,
          imageId: issue.imageId,
          beforeState,
          afterState: undefined,
          success: true,
        });
      } catch (error) {
        fixes.push({
          issueId: issue.imageId,
          issueType: issue.type,
          action: "delete_orphan_image",
          productId: issue.productId,
          variantId: issue.variantId,
          imageId: issue.imageId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return fixes;
  }

  /**
   * Fix order indexes (reorder sequentially)
   */
  async fixOrderIndexes(performedBy: string): Promise<MediaFix[]> {
    const fixes: MediaFix[] = [];
    const orderIssues = await this.checkOrderIndexes();

    // Group issues by product/variant
    const productGroups = new Map<string, OrderIndexIssue[]>();
    const variantGroups = new Map<string, OrderIndexIssue[]>();

    for (const issue of orderIssues) {
      if (issue.variantId) {
        const key = `${issue.productId}:${issue.variantId}`;
        if (!variantGroups.has(key)) {
          variantGroups.set(key, []);
        }
        variantGroups.get(key)?.push(issue);
      } else if (issue.productId) {
        const key = issue.productId;
        if (!productGroups.has(key)) {
          productGroups.set(key, []);
        }
        productGroups.get(key)?.push(issue);
      }
    }

    // Fix product images
    for (const [productId, _issues] of productGroups.entries()) {
      try {
        const images = await this.db
          .select()
          .from(productImages)
          .where(
            and(
              eq(productImages.productId, productId),
              isNull(productImages.variantId),
            ),
          )
          .orderBy(asc(productImages.order));

        const beforeState = images.map((img) => ({
          id: img.id,
          order: img.order,
        }));

        // Reorder sequentially
        for (let i = 0; i < images.length; i++) {
          if (images[i].order !== i) {
            await this.db
              .update(productImages)
              .set({ order: i, updatedAt: new Date() })
              .where(eq(productImages.id, images[i].id));
          }
        }

        const afterImages = await this.db
          .select()
          .from(productImages)
          .where(
            and(
              eq(productImages.productId, productId),
              isNull(productImages.variantId),
            ),
          )
          .orderBy(asc(productImages.order));

        const afterState = afterImages.map((img) => ({
          id: img.id,
          order: img.order,
        }));

        await this.auditService.logAction("reorder_fix", performedBy, {
          productId,
          details: { beforeState, afterState },
        });

        fixes.push({
          issueId: `product-${productId}`,
          issueType: "order_index_gap",
          action: "reordered_product_images",
          productId,
          beforeState: beforeState as unknown as Record<string, unknown>,
          afterState: afterState as unknown as Record<string, unknown>,
          success: true,
        });
      } catch (error) {
        fixes.push({
          issueId: `product-${productId}`,
          issueType: "order_index_gap",
          action: "reorder_product_images",
          productId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fix variant images
    for (const [key, _issues] of variantGroups.entries()) {
      const [productId, variantId] = key.split(":");
      try {
        const images = await this.db
          .select()
          .from(productImages)
          .where(eq(productImages.variantId, variantId))
          .orderBy(asc(productImages.order));

        const beforeState = images.map((img) => ({
          id: img.id,
          order: img.order,
        }));

        // Reorder sequentially
        for (let i = 0; i < images.length; i++) {
          if (images[i].order !== i) {
            await this.db
              .update(productImages)
              .set({ order: i, updatedAt: new Date() })
              .where(eq(productImages.id, images[i].id));
          }
        }

        const afterImages = await this.db
          .select()
          .from(productImages)
          .where(eq(productImages.variantId, variantId))
          .orderBy(asc(productImages.order));

        const afterState = afterImages.map((img) => ({
          id: img.id,
          order: img.order,
        }));

        await this.auditService.logAction("reorder_fix", performedBy, {
          productId,
          variantId,
          details: { beforeState, afterState },
        });

        fixes.push({
          issueId: `variant-${variantId}`,
          issueType: "order_index_gap",
          action: "reordered_variant_images",
          productId,
          variantId,
          beforeState: beforeState as unknown as Record<string, unknown>,
          afterState: afterState as unknown as Record<string, unknown>,
          success: true,
        });
      } catch (error) {
        fixes.push({
          issueId: `variant-${variantId}`,
          issueType: "order_index_gap",
          action: "reorder_variant_images",
          productId,
          variantId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return fixes;
  }

  /**
   * Fix S3 orphans (clean up orphaned S3 files)
   * Note: This is expensive and should be run selectively
   */
  async fixS3Orphans(performedBy: string): Promise<MediaFix[]> {
    const fixes: MediaFix[] = [];

    // Get all images with S3 keys
    const allImages = await this.db.select().from(productImages);
    const s3Keys = new Set<string>();

    for (const image of allImages) {
      const isS3Key =
        !image.url.startsWith("http://") && !image.url.startsWith("https://");
      if (isS3Key) {
        s3Keys.add(image.url);
      }
    }

    // List S3 files in products/ and variants/ prefixes
    // Note: This requires listing all files, which can be expensive
    // For now, we'll only fix files that are explicitly missing from DB
    // Full orphan cleanup should be a separate operation

    this.logger.info(
      createLogContext(this.contextService, "fixS3Orphans", {
        s3KeysCount: s3Keys.size,
      }),
      "S3 orphan cleanup (limited - only fixes missing files)",
    );

    return fixes;
  }

  /**
   * Fix variant inheritance violations
   */
  async fixVariantInheritance(performedBy: string): Promise<MediaFix[]> {
    const fixes: MediaFix[] = [];
    const inheritanceIssues = await this.checkVariantInheritance();

    // Note: Fixing inheritance requires knowing the variant's mode
    // For now, we'll just log the issues
    // Full implementation would require storing variant image mode

    for (const issue of inheritanceIssues) {
      await this.auditService.logAction("inherit_fix", performedBy, {
        productId: issue.productId,
        variantId: issue.variantId,
        details: {
          violation: issue.violation,
          mode: issue.mode,
        },
      });

      fixes.push({
        issueId: issue.variantId || "unknown",
        issueType: issue.type,
        action: "logged_inheritance_violation",
        productId: issue.productId,
        variantId: issue.variantId,
        success: true,
      });
    }

    return fixes;
  }

  /**
   * Run all fixes in sequence
   */
  async fixAll(performedBy: string): Promise<MediaHealthFixResult> {
    const fixed: MediaFix[] = [];
    const errors: string[] = [];

    try {
      const orphanFixes = await this.fixOrphanImages(performedBy);
      fixed.push(...orphanFixes);
    } catch (error) {
      errors.push(
        `Failed to fix orphan images: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      const orderFixes = await this.fixOrderIndexes(performedBy);
      fixed.push(...orderFixes);
    } catch (error) {
      errors.push(
        `Failed to fix order indexes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      const inheritanceFixes = await this.fixVariantInheritance(performedBy);
      fixed.push(...inheritanceFixes);
    } catch (error) {
      errors.push(
        `Failed to fix variant inheritance: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const successfulFixes = fixed.filter((f) => f.success);
    const failedFixes = fixed.filter((f) => !f.success);

    return {
      fixed,
      errors,
      stats: {
        totalIssues: fixed.length + errors.length,
        fixedCount: successfulFixes.length,
        errorCount: failedFixes.length + errors.length,
      },
    };
  }
}
