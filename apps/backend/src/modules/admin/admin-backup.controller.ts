import { Controller, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { DatabaseBackupService } from "../database/database-backup.service";

@ApiTags("admin")
@Controller("admin/backups")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class AdminBackupController {
  constructor(private readonly backupService: DatabaseBackupService) {}

  @Post("trigger")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Manually trigger database backup",
    description:
      "Manually triggers a database backup to Supabase Storage. Backups also run automatically every 15 minutes via cron job.",
  })
  @ApiResponse({
    status: 200,
    description: "Backup triggered successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        backupName: { type: "string" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Backup service is not enabled or configuration is missing",
  })
  async triggerBackup(): Promise<{
    success: boolean;
    message: string;
    backupName?: string;
  }> {
    // Check if backups are enabled
    const isEnabled =
      process.env.DB_BACKUP_ENABLED === "true" ||
      (process.env.SUPABASE_URL &&
        (process.env.SUPABASE_STORAGE_KEY || process.env.SUPABASE_ANON_KEY));

    if (!isEnabled) {
      return {
        success: false,
        message:
          "Database backups are not enabled. Set DB_BACKUP_ENABLED=true and configure SUPABASE_URL with storage credentials.",
      };
    }

    const backupName = `manual-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;

    try {
      await this.backupService.triggerBackup();
      return {
        success: true,
        message: "Database backup triggered successfully",
        backupName,
      };
    } catch (error) {
      return {
        success: false,
        message: `Backup failed: ${error instanceof Error ? error.message : String(error)}`,
        backupName,
      };
    }
  }
}
