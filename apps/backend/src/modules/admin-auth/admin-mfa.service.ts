import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { admin2fa, eq, users } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { authenticator } from "otplib";
import * as qrcode from "qrcode";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";

@Injectable()
export class AdminMfaService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Generate a new TOTP secret for an admin
   */
  async generateSecret(
    adminId: string,
  ): Promise<{ secret: string; otpAuthUrl: string }> {
    const [admin] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, adminId))
      .limit(1);

    if (!admin) {
      throw new NotFoundException("Admin not found");
    }

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(
      admin.email,
      process.env.APP_NAME || "VCEcom Admin",
      secret,
    );

    // Store secret temporarily (not enabled yet)
    try {
      await this.db
        .insert(admin2fa)
        .values({
          adminId,
          secret,
          backupCodes: [],
          enabled: false,
        })
        .onConflictDoUpdate({
          target: admin2fa.adminId,
          set: {
            secret,
            enabled: false,
          },
        });

      this.logger.info(
        createLogContext(this.contextService, "generateMfaSecret", { adminId }),
        "Generated new MFA secret for admin",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "generateMfaSecret", error, {
          adminId,
        }),
        "Failed to store generated MFA secret",
      );
      throw new BadRequestException("Failed to generate 2FA secret");
    }

    return { secret, otpAuthUrl };
  }

  /**
   * Generate a QR code image (data URL) for the given OTP Auth URL
   */
  async generateQRCode(otpAuthUrl: string): Promise<string> {
    try {
      return await qrcode.toDataURL(otpAuthUrl);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "generateMfaQRCode", error),
        "Failed to generate MFA QR code",
      );
      throw new BadRequestException("Failed to generate QR code");
    }
  }

  /**
   * Enable 2FA for an admin after verifying the initial code
   */
  async enable2FA(
    adminId: string,
    secret: string,
    code: string,
  ): Promise<string[]> {
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      this.logger.warn(
        createLogContext(this.contextService, "enableMfa", {
          adminId,
          status: "failed",
          reason: "Invalid code",
        }),
        "Failed to enable MFA: Invalid code",
      );
      throw new BadRequestException("Invalid 2FA code");
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase(),
    );

    try {
      await this.db
        .insert(admin2fa)
        .values({ adminId, secret, backupCodes, enabled: true })
        .onConflictDoUpdate({
          target: admin2fa.adminId,
          set: { secret, backupCodes, enabled: true },
        });

      this.logger.info(
        createLogContext(this.contextService, "enableMfa", {
          adminId,
          status: "success",
        }),
        "MFA enabled for admin",
      );
      return backupCodes;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "enableMfa", error, {
          adminId,
        }),
        "Failed to enable MFA in database",
      );
      throw new BadRequestException("Failed to enable 2FA");
    }
  }

  /**
   * Disable 2FA for an admin
   */
  async disable2FA(adminId: string, code: string): Promise<boolean> {
    const [existing2fa] = await this.db
      .select()
      .from(admin2fa)
      .where(eq(admin2fa.adminId, adminId))
      .limit(1);

    if (!existing2fa || !existing2fa.enabled) {
      throw new BadRequestException("2FA is not enabled for this admin");
    }

    // Verify code before disabling
    const isValid = authenticator.verify({
      token: code,
      secret: existing2fa.secret,
    });

    if (!isValid && !existing2fa.backupCodes?.includes(code)) {
      this.logger.warn(
        createLogContext(this.contextService, "disableMfa", {
          adminId,
          status: "failed",
          reason: "Invalid code",
        }),
        "Failed to disable MFA: Invalid code",
      );
      throw new UnauthorizedException("Invalid 2FA code or backup code");
    }

    try {
      await this.db
        .update(admin2fa)
        .set({ enabled: false, secret: "", backupCodes: [] }) // Clear secret and backup codes
        .where(eq(admin2fa.adminId, adminId));

      this.logger.info(
        createLogContext(this.contextService, "disableMfa", { adminId }),
        "MFA disabled for admin",
      );
      return true;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "disableMfa", error, {
          adminId,
        }),
        "Failed to disable MFA in database",
      );
      throw new BadRequestException("Failed to disable 2FA");
    }
  }

  /**
   * Verify a TOTP code or backup code for an admin
   */
  async verify2FA(adminId: string, code: string): Promise<boolean> {
    const [admin2faConfig] = await this.db
      .select()
      .from(admin2fa)
      .where(eq(admin2fa.adminId, adminId))
      .limit(1);

    if (!admin2faConfig || !admin2faConfig.enabled) {
      // If 2FA is not enabled, verification should fail
      return false;
    }

    // Check backup codes first
    const backupCodeIndex = admin2faConfig.backupCodes?.indexOf(code);
    if (backupCodeIndex !== undefined && backupCodeIndex !== -1) {
      // Remove used backup code
      const updatedBackupCodes = admin2faConfig.backupCodes?.filter(
        (_, i) => i !== backupCodeIndex,
      );
      await this.db
        .update(admin2fa)
        .set({ backupCodes: updatedBackupCodes })
        .where(eq(admin2fa.adminId, adminId));

      this.logger.info(
        createLogContext(this.contextService, "verifyMfaBackupCode", {
          adminId,
          status: "success",
        }),
        "MFA backup code verification successful",
      );
      return true;
    }

    // Verify TOTP code
    const isValid = authenticator.verify({
      token: code,
      secret: admin2faConfig.secret,
    });

    if (!isValid) {
      this.logger.warn(
        createLogContext(this.contextService, "verifyMfa", {
          adminId,
          status: "failed",
          reason: "Invalid code",
        }),
        "MFA verification failed: Invalid code",
      );
      return false;
    }

    this.logger.info(
      createLogContext(this.contextService, "verifyMfa", {
        adminId,
        status: "success",
      }),
      "MFA verification successful",
    );
    return true;
  }

  /**
   * Check if 2FA is enabled for admin
   */
  async is2FAEnabled(adminId: string): Promise<boolean> {
    try {
      const [mfaRecord] = await this.db
        .select({ enabled: admin2fa.enabled })
        .from(admin2fa)
        .where(eq(admin2fa.adminId, adminId))
        .limit(1);

      return mfaRecord?.enabled || false;
    } catch (error) {
      // If table doesn't exist yet, assume 2FA is not enabled
      if (error.message?.includes('relation "admin_2fa" does not exist')) {
        return false;
      }
      throw error;
    }
  }
}
