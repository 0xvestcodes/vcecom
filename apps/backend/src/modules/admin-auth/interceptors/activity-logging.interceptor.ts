import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { discounts, eq, orders, products } from "@vcecom/db";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { ContextService } from "../../../common/logging/context.service";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { AdminActivityService } from "../admin-activity.service";
import {
  LOG_ACTIVITY_KEY,
  LogActivityMetadata,
} from "../decorators/log-activity.decorator";

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activityService: AdminActivityService,
    readonly _contextService: ContextService, // Renamed to _contextService to avoid unused private member lint error
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<LogActivityMetadata>(
      LOG_ACTIVITY_KEY,
      context.getHandler(),
    );

    // If no metadata, skip logging
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Only log if user is authenticated and is an admin
    if (!user || !user.id) {
      return next.handle();
    }

    // Check if user is an admin role
    const adminRoles = ["admin", "support", "reviewer", "marketing"];
    if (!adminRoles.includes(user.role)) {
      return next.handle();
    }

    // Extract entity ID from request params, body, or query
    let entityId: string | undefined;
    if (metadata.entityId) {
      // If entityId is specified, try to get it from params, body, or query
      entityId =
        request.params?.[metadata.entityId] ||
        request.body?.[metadata.entityId] ||
        request.query?.[metadata.entityId];
    } else {
      // Default: try to get "id" from params
      entityId = request.params?.id;
    }

    // Extract metadata from request body (excluding sensitive fields)
    const metadataFields: Record<string, unknown> = {};
    if (request.body) {
      const sensitiveFields = ["password", "passwordhash", "token", "secret"];
      Object.keys(request.body).forEach((key) => {
        if (!sensitiveFields.includes(key.toLowerCase())) {
          metadataFields[key] = request.body[key];
        }
      });
    }

    // Determine if we should capture diff
    const shouldCaptureDiff =
      metadata.captureDiff &&
      metadata.entityType &&
      entityId &&
      (request.method === "PUT" || request.method === "PATCH");

    // Log activity after successful execution
    return next.handle().pipe(
      tap({
        next: (response) => {
          // Handle diff capture asynchronously
          if (shouldCaptureDiff && metadata.entityType && entityId) {
            // Fetch before state and log with diff asynchronously
            this.fetchBeforeState(metadata.entityType, entityId)
              .then((beforeState) => {
                const afterState = this.extractAfterState(
                  response,
                  metadata.entityType,
                );

                if (beforeState || afterState) {
                  this.activityService
                    .logActivityWithDiff({
                      adminId: user.id,
                      action: metadata.action,
                      entityId,
                      metadata:
                        Object.keys(metadataFields).length > 0
                          ? metadataFields
                          : undefined,
                      diff: {
                        before: beforeState,
                        after: afterState,
                      },
                    })
                    .catch(() => {
                      // Silently fail
                    });
                } else {
                  // Fallback to regular logging
                  this.activityService.logActivity({
                    adminId: user.id,
                    action: metadata.action,
                    entityId,
                    metadata:
                      Object.keys(metadataFields).length > 0
                        ? metadataFields
                        : undefined,
                  });
                }
              })
              .catch(() => {
                // If before state fetch fails, log without diff
                this.activityService.logActivity({
                  adminId: user.id,
                  action: metadata.action,
                  entityId,
                  metadata:
                    Object.keys(metadataFields).length > 0
                      ? metadataFields
                      : undefined,
                });
              });
          } else {
            // Log successful activity without diff
            this.activityService.logActivity({
              adminId: user.id,
              action: metadata.action,
              entityId,
              metadata:
                Object.keys(metadataFields).length > 0
                  ? metadataFields
                  : undefined,
            });
          }
        },
        error: (error) => {
          // Log failed activity with error info
          this.activityService.logActivity({
            adminId: user.id,
            action: metadata.action,
            entityId,
            metadata: {
              ...metadataFields,
              error: error.message,
              errorType: error.constructor.name,
            },
          });
        },
      }),
    );
  }

  /**
   * Fetch before state for diff capture
   */
  private async fetchBeforeState(
    entityType: string | undefined,
    entityId: string | undefined,
  ): Promise<Record<string, unknown> | null> {
    if (!entityType || !entityId) {
      return null;
    }

    try {
      switch (entityType.toLowerCase()) {
        case "product": {
          const [product] = await this.db
            .select()
            .from(products)
            .where(eq(products.id, entityId))
            .limit(1);
          return product ? (product as Record<string, unknown>) : null;
        }

        case "discount": {
          const [discount] = await this.db
            .select()
            .from(discounts)
            .where(eq(discounts.id, entityId))
            .limit(1);
          return discount ? (discount as Record<string, unknown>) : null;
        }

        case "order": {
          const [order] = await this.db
            .select()
            .from(orders)
            .where(eq(orders.id, entityId))
            .limit(1);
          return order ? (order as Record<string, unknown>) : null;
        }

        default:
          return null;
      }
    } catch (_error) {
      return null;
    }
  }

  /**
   * Extract after state from response
   */
  private extractAfterState(
    response: unknown,
    entityType?: string,
  ): Record<string, unknown> | null {
    if (!response || typeof response !== "object") {
      return null;
    }

    // If response is already a plain object, return it
    if (response && typeof response === "object" && !Array.isArray(response)) {
      // Filter out sensitive fields
      const sensitiveFields = ["password", "passwordhash", "token", "secret"];
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(response)) {
        if (!sensitiveFields.includes(key.toLowerCase())) {
          filtered[key] = value;
        }
      }
      return filtered;
    }

    return null;
  }
}
