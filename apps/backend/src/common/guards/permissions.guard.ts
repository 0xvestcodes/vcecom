import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq, users } from "@vcecom/db";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import {
  PERMISSIONS_KEY,
  PermissionsMetadata,
} from "../decorators/permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<PermissionsMetadata>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions metadata, allow access (backward compatibility)
    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user (not authenticated), throw 401
    if (!user) {
      throw new UnauthorizedException(
        "Authentication required. Please provide a valid JWT token.",
      );
    }

    // Check if user has the required permission
    const hasPermission = await this.checkPermission(
      user.id,
      metadata.resource,
      metadata.action,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied. This endpoint requires ${metadata.resource}:${metadata.action} permission.`,
      );
    }

    return true;
  }

  /**
   * Check if a user has a specific permission
   */
  private async checkPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    try {
      // Get user with role
      const [user] = await this.db
        .select({
          role: users.role,
          roleId: users.roleId,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return false;
      }

      // If user has "admin" role (legacy), grant all permissions
      if (user.role === "admin") {
        return true;
      }

      // If no roleId, fall back to legacy role-based check
      if (!user.roleId) {
        // For backward compatibility, check legacy roles
        // This can be enhanced later with default permissions per role
        return false;
      }

      // Get role permissions
      const { adminRoles } = await import("@vcecom/db");
      const [role] = await this.db
        .select()
        .from(adminRoles)
        .where(eq(adminRoles.id, user.roleId))
        .limit(1);

      if (!role) {
        return false;
      }

      // Check if permission exists
      const permissions = role.permissions as Record<
        string,
        string[] | undefined
      >;
      const resourcePermissions = permissions[resource];

      if (!resourcePermissions) {
        return false;
      }

      return resourcePermissions.includes(action);
    } catch (_error) {
      // On error, deny access for security
      return false;
    }
  }
}
