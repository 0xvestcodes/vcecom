import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { admin2fa, eq, users } from "@vcecom/db";
import type { Request } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { AdminMfaService } from "./admin-mfa.service";
import {
  Disable2FADto,
  Enable2FADto,
  Enable2FAResponseDto,
  GenerateSecretResponseDto,
  Verify2FADto,
} from "./dto/mfa.dto";

@ApiTags("admin")
@Controller("admin/auth/2fa")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class AdminMfaController {
  constructor(
    private readonly mfaService: AdminMfaService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  @Get("status")
  @ApiOperation({
    summary: "Get 2FA status",
    description: "Check if 2FA is enabled for the current admin",
  })
  @ApiOkResponse({
    description: "2FA status retrieved successfully",
    schema: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async getStatus(
    @Req() req: Request & { user?: { id?: string; sub?: string } },
  ): Promise<{ enabled: boolean }> {
    const adminId = req.user?.id || req.user?.sub;
    if (!adminId) {
      throw new Error("Admin ID not found");
    }

    const enabled = await this.mfaService.is2FAEnabled(adminId);
    return { enabled };
  }

  @Post("generate-secret")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Generate TOTP secret",
    description:
      "Generate a new TOTP secret and QR code for setting up 2FA. This does not enable 2FA yet.",
  })
  @ApiOkResponse({
    description: "Secret and QR code generated successfully",
    type: GenerateSecretResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async generateSecret(
    @Req() req: Request & {
      user?: { id?: string; sub?: string; email?: string };
    },
  ): Promise<GenerateSecretResponseDto> {
    const adminId = req.user?.id || req.user?.sub;
    if (!adminId) {
      throw new Error("Admin ID not found");
    }

    // Get admin email for QR code
    const [admin] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, adminId))
      .limit(1);

    if (!admin) {
      throw new Error("Admin not found");
    }

    const { secret, otpAuthUrl } =
      await this.mfaService.generateSecret(adminId);
    const qrCode = await this.mfaService.generateQRCode(otpAuthUrl);

    return {
      secret,
      qrCode,
    };
  }

  @Post("enable")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Enable 2FA",
    description:
      "Enable 2FA after verifying the TOTP code. Returns backup codes that should be saved securely.",
  })
  @ApiOkResponse({
    description: "2FA enabled successfully",
    type: Enable2FAResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid TOTP code",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async enable(
    @Body() dto: Enable2FADto,
    @Req() req: Request & { user?: { id?: string; sub?: string } },
  ): Promise<Enable2FAResponseDto> {
    const adminId = req.user?.id || req.user?.sub;
    if (!adminId) {
      throw new Error("Admin ID not found");
    }

    // Get the secret from the database
    const [mfaRecord] = await this.db
      .select({ secret: admin2fa.secret })
      .from(admin2fa)
      .where(eq(admin2fa.adminId, adminId))
      .limit(1);

    if (!mfaRecord || !mfaRecord.secret) {
      throw new Error("No secret found. Please generate a secret first.");
    }

    const backupCodes = await this.mfaService.enable2FA(
      adminId,
      mfaRecord.secret,
      dto.code,
    );

    return {
      backupCodes,
    };
  }

  @Post("disable")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Disable 2FA",
    description: "Disable 2FA by providing a valid TOTP code or backup code",
  })
  @ApiOkResponse({
    description: "2FA disabled successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", example: "2FA disabled successfully" },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Invalid code",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async disable(
    @Body() dto: Disable2FADto,
    @Req() req: Request & { user?: { id?: string; sub?: string } },
  ): Promise<{ message: string }> {
    const adminId = req.user?.id || req.user?.sub;
    if (!adminId) {
      throw new Error("Admin ID not found");
    }

    await this.mfaService.disable2FA(adminId, dto.code);

    return { message: "2FA disabled successfully" };
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify 2FA code",
    description:
      "Verify a TOTP code or backup code. Used during login when 2FA is enabled.",
  })
  @ApiOkResponse({
    description: "Code verified successfully",
    schema: {
      type: "object",
      properties: {
        valid: { type: "boolean" },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Invalid code",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async verify(
    @Body() dto: Verify2FADto,
    @Req() req: Request & { user?: { id?: string; sub?: string } },
  ): Promise<{ valid: boolean }> {
    const adminId = req.user?.id || req.user?.sub;
    if (!adminId) {
      throw new Error("Admin ID not found");
    }

    const valid = await this.mfaService.verify2FA(adminId, dto.code);
    return { valid };
  }
}
