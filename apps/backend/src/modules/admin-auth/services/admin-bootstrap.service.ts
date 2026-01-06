import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { eq, users } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { hashPassword, verifyPassword } from "../utils/password.utils";

/**
 * Service to ensure admin user exists on application startup
 * Creates or updates admin user based on environment variables
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly adminEmail: string;
  private readonly adminPassword: string;

  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    // Get admin credentials from environment variables
    this.adminEmail = process.env.ADMIN_EMAIL || "admin@vcecom.local";
    this.adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
  }

  /**
   * Ensure admin user exists on module initialization
   * Called automatically by NestJS when the module is initialized
   */
  async onModuleInit(): Promise<void> {
    // Skip if explicitly disabled
    if (process.env.ENSURE_ADMIN_ON_STARTUP === "false") {
      this.logger.debug(
        createLogContext(this.contextService, "adminBootstrapSkipped", {}),
        "Admin bootstrap skipped - ENSURE_ADMIN_ON_STARTUP=false",
      );
      return;
    }

    try {
      await this.ensureAdminUser();
    } catch (error) {
      // Log error but don't fail startup - admin can be created manually
      this.logger.error(
        createErrorContext(this.contextService, "adminBootstrapError", error),
        "Failed to ensure admin user on startup - application will continue",
      );
      // Don't throw - allow app to start even if admin creation fails
    }
  }

  /**
   * Ensure admin user exists with correct credentials
   */
  private async ensureAdminUser(): Promise<void> {
    const startTime = Date.now();

    try {
      // Check if admin user exists
      const [existingAdmin] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, this.adminEmail))
        .limit(1);

      if (existingAdmin) {
        // Admin exists - verify password and update if needed
        // If no password hash exists, we need to create one
        if (!existingAdmin.passwordHash) {
          // No password hash - create one
          const passwordHash = await hashPassword(this.adminPassword);
          await this.db
            .update(users)
            .set({
              passwordHash,
              role: "admin", // Ensure role is admin
            })
            .where(eq(users.id, existingAdmin.id));

          this.logger.info(
            createLogContext(this.contextService, "adminPasswordCreated", {
              adminId: existingAdmin.id,
              email: this.adminEmail,
              elapsedMs: Date.now() - startTime,
            }),
            "Admin user password hash created on startup",
          );
          return;
        }

        // Verify existing password
        let isValid = false;
        try {
          isValid = await verifyPassword(
            existingAdmin.passwordHash,
            this.adminPassword,
          );
        } catch (error) {
          // If verification fails (e.g., invalid hash format), update password
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "adminPasswordVerificationFailed",
              error,
              { adminId: existingAdmin.id },
            ),
            "Password verification failed - updating password hash",
          );
        }

        if (!isValid) {
          // Update password if it doesn't match
          const passwordHash = await hashPassword(this.adminPassword);
          await this.db
            .update(users)
            .set({
              passwordHash,
              role: "admin", // Ensure role is admin
            })
            .where(eq(users.id, existingAdmin.id));

          this.logger.info(
            createLogContext(this.contextService, "adminPasswordUpdated", {
              adminId: existingAdmin.id,
              email: this.adminEmail,
              elapsedMs: Date.now() - startTime,
            }),
            "Admin user password updated on startup",
          );
        } else {
          // Ensure role is admin
          if (existingAdmin.role !== "admin") {
            await this.db
              .update(users)
              .set({ role: "admin" })
              .where(eq(users.id, existingAdmin.id));

            this.logger.info(
              createLogContext(this.contextService, "adminRoleUpdated", {
                adminId: existingAdmin.id,
                email: this.adminEmail,
                elapsedMs: Date.now() - startTime,
              }),
              "Admin user role updated to 'admin' on startup",
            );
          } else {
            this.logger.debug(
              createLogContext(this.contextService, "adminExists", {
                adminId: existingAdmin.id,
                email: this.adminEmail,
                elapsedMs: Date.now() - startTime,
              }),
              "Admin user already exists with correct credentials",
            );
          }
        }
      } else {
        // Create admin user
        const passwordHash = await hashPassword(this.adminPassword);
        const [adminUser] = await this.db
          .insert(users)
          .values({
            email: this.adminEmail,
            passwordHash,
            role: "admin",
          } as {
            email: string;
            passwordHash: string;
            role: "admin" | "customer" | "support" | "reviewer" | "marketing";
          })
          .returning();

        if (!adminUser) {
          throw new Error("Failed to create admin user - no user returned");
        }

        this.logger.info(
          createLogContext(this.contextService, "adminCreated", {
            adminId: adminUser.id,
            email: this.adminEmail,
            elapsedMs: Date.now() - startTime,
          }),
          "Admin user created successfully on startup",
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "ensureAdminUser", error, {
          email: this.adminEmail,
          elapsedMs: Date.now() - startTime,
        }),
        "Error ensuring admin user exists",
      );
      throw error;
    }
  }
}
