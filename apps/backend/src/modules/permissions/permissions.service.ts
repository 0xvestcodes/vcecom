import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { adminRoles, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import {
  CreateRoleDto,
  RoleResponseDto,
  UpdateRoleDto,
} from "./dto/permissions.dto";

@Injectable()
export class PermissionsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get all roles
   */
  async getRoles(): Promise<RoleResponseDto[]> {
    try {
      const roles = await this.db
        .select()
        .from(adminRoles)
        .orderBy(adminRoles.name);

      return roles.map((role) => this.mapToResponseDto(role));
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getRoles", error),
        "Failed to get roles",
      );
      throw error;
    }
  }

  /**
   * Get a single role by ID
   */
  async getRole(id: string): Promise<RoleResponseDto> {
    try {
      const [role] = await this.db
        .select()
        .from(adminRoles)
        .where(eq(adminRoles.id, id))
        .limit(1);

      if (!role) {
        throw new NotFoundException(`Role with ID ${id} not found`);
      }

      return this.mapToResponseDto(role);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(this.contextService, "getRole", error, { id }),
        "Failed to get role",
      );
      throw error;
    }
  }

  /**
   * Create a new role
   */
  async createRole(dto: CreateRoleDto): Promise<RoleResponseDto> {
    try {
      // Check if role name already exists
      const [existing] = await this.db
        .select()
        .from(adminRoles)
        .where(eq(adminRoles.name, dto.name))
        .limit(1);

      if (existing) {
        throw new BadRequestException(
          `Role with name "${dto.name}" already exists`,
        );
      }

      // Validate permissions structure
      this.validatePermissions(dto.permissions);

      const [created] = await this.db
        .insert(adminRoles)
        .values({
          name: dto.name,
          permissions: dto.permissions as Record<string, unknown>,
        })
        .returning();

      return this.mapToResponseDto(created);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        createErrorContext(this.contextService, "createRole", error, { dto }),
        "Failed to create role",
      );
      throw error;
    }
  }

  /**
   * Update a role
   */
  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    try {
      // Check if role exists
      const [existing] = await this.db
        .select()
        .from(adminRoles)
        .where(eq(adminRoles.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Role with ID ${id} not found`);
      }

      // Check if new name conflicts with another role
      if (dto.name && dto.name !== existing.name) {
        const [conflicting] = await this.db
          .select()
          .from(adminRoles)
          .where(eq(adminRoles.name, dto.name))
          .limit(1);

        if (conflicting) {
          throw new BadRequestException(
            `Role with name "${dto.name}" already exists`,
          );
        }
      }

      // Validate permissions if provided
      if (dto.permissions) {
        this.validatePermissions(dto.permissions);
      }

      const [updated] = await this.db
        .update(adminRoles)
        .set({
          name: dto.name ?? existing.name,
          permissions: dto.permissions
            ? (dto.permissions as Record<string, unknown>)
            : existing.permissions,
          updatedAt: new Date(),
        })
        .where(eq(adminRoles.id, id))
        .returning();

      return this.mapToResponseDto(updated);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        createErrorContext(this.contextService, "updateRole", error, {
          id,
          dto,
        }),
        "Failed to update role",
      );
      throw error;
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string): Promise<void> {
    try {
      // Check if role exists
      const [existing] = await this.db
        .select()
        .from(adminRoles)
        .where(eq(adminRoles.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Role with ID ${id} not found`);
      }

      // Check if any users are using this role
      const { users } = await import("@vcecom/db");
      const usersWithRole = await this.db
        .select()
        .from(users)
        .where(eq(users.roleId, id))
        .limit(1);

      if (usersWithRole.length > 0) {
        throw new BadRequestException(
          `Cannot delete role "${existing.name}" because it is assigned to ${usersWithRole.length} user(s)`,
        );
      }

      await this.db.delete(adminRoles).where(eq(adminRoles.id, id));
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        createErrorContext(this.contextService, "deleteRole", error, { id }),
        "Failed to delete role",
      );
      throw error;
    }
  }

  /**
   * Get permissions for a role
   */
  async getRolePermissions(roleId: string): Promise<Record<string, string[]>> {
    const role = await this.getRole(roleId);
    return role.permissions;
  }

  /**
   * Check if a user has a specific permission
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    try {
      const { users } = await import("@vcecom/db");
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

      // Legacy admin role has all permissions
      if (user.role === "admin") {
        return true;
      }

      // If no roleId, deny access
      if (!user.roleId) {
        return false;
      }

      // Get role permissions
      const [role] = await this.db
        .select()
        .from(adminRoles)
        .where(eq(adminRoles.id, user.roleId))
        .limit(1);

      if (!role) {
        return false;
      }

      const permissions = role.permissions as Record<
        string,
        string[] | undefined
      >;
      const resourcePermissions = permissions[resource];

      if (!resourcePermissions) {
        return false;
      }

      return resourcePermissions.includes(action);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "checkPermission", error, {
          userId,
          resource,
          action,
        }),
        "Failed to check permission",
      );
      return false;
    }
  }

  /**
   * Validate permissions structure
   */
  private validatePermissions(permissions: Record<string, string[]>): void {
    if (!permissions || typeof permissions !== "object") {
      throw new BadRequestException("Permissions must be an object");
    }

    for (const [resource, actions] of Object.entries(permissions)) {
      if (!Array.isArray(actions)) {
        throw new BadRequestException(
          `Permissions for resource "${resource}" must be an array`,
        );
      }

      if (actions.length === 0) {
        throw new BadRequestException(
          `Resource "${resource}" must have at least one action`,
        );
      }

      for (const action of actions) {
        if (typeof action !== "string") {
          throw new BadRequestException(
            `Action in resource "${resource}" must be a string`,
          );
        }
      }
    }
  }

  /**
   * Map database role to response DTO
   */
  private mapToResponseDto(
    role: typeof adminRoles.$inferSelect,
  ): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      permissions: role.permissions as Record<string, string[]>,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
