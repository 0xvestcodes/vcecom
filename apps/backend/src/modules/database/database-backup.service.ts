import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createLogContext } from "../../common/logging/logging.helper";

const execAsync = promisify(exec);

/**
 * Service to handle automated database backups to Supabase Storage
 * Runs backups every 15 minutes
 */
@Injectable()
export class DatabaseBackupService implements OnModuleInit {
  private readonly logger: PinoLogger;
  private readonly backupScriptPath: string;

  constructor(
    logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    this.logger = logger;
    // Resolve backup script path
    // Try multiple possible paths to handle both development and production
    const possiblePaths = [
      // Production path (compiled) - dist/modules/database -> scripts/
      resolve(__dirname, "../../../scripts/backup-database.sh"),
      // Development path (from source) - apps/backend/src/modules/database -> scripts/
      resolve(__dirname, "../../../../scripts/backup-database.sh"),
      // Alternative: from process.cwd()
      resolve(process.cwd(), "apps/backend/scripts/backup-database.sh"),
      resolve(process.cwd(), "scripts/backup-database.sh"),
    ];

    // Find the first existing path
    let foundPath: string | null = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        foundPath = path;
        break;
      }
    }

    if (!foundPath) {
      // Use the first path as fallback (will fail with clear error if script doesn't exist)
      foundPath = possiblePaths[0];
      this.logger.warn(
        createLogContext(this.contextService, "constructor", {
          attemptedPaths: possiblePaths,
        }),
        "Backup script not found at any expected location. Will attempt to use: " +
          foundPath,
      );
    }

    this.backupScriptPath = foundPath;
  }

  onModuleInit() {
    // Check if database backups are enabled
    const isEnabled =
      process.env.DB_BACKUP_ENABLED === "true" ||
      (process.env.SUPABASE_URL &&
        (process.env.SUPABASE_STORAGE_KEY || process.env.SUPABASE_ANON_KEY));

    if (!isEnabled) {
      this.logger.info(
        createLogContext(this.contextService, "onModuleInit", {}),
        "Database backup service disabled - set DB_BACKUP_ENABLED=true and SUPABASE_URL to enable",
      );
      return;
    }

    this.logger.info(
      createLogContext(this.contextService, "onModuleInit", {
        backupScriptPath: this.backupScriptPath,
      }),
      "Database backup service initialized - backups will run every 15 minutes",
    );
  }

  /**
   * Run database backup
   * Called every 15 minutes via cron
   * Only runs if backups are enabled
   */
  @Cron("*/15 * * * *") // Every 15 minutes
  async runBackup(): Promise<void> {
    // Check if backups are enabled
    const isEnabled =
      process.env.DB_BACKUP_ENABLED === "true" ||
      (process.env.SUPABASE_URL &&
        (process.env.SUPABASE_STORAGE_KEY || process.env.SUPABASE_ANON_KEY));

    if (!isEnabled) {
      // Silently skip if backups are not enabled
      return;
    }
    const backupName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;

    this.logger.info(
      createLogContext(this.contextService, "runBackup", {
        backupName,
      }),
      "Starting scheduled database backup",
    );

    try {
      // Check if required environment variables are set
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL environment variable is not set");
      }

      if (!process.env.SUPABASE_URL) {
        throw new Error("SUPABASE_URL environment variable is not set");
      }

      if (!process.env.SUPABASE_STORAGE_KEY && !process.env.SUPABASE_ANON_KEY) {
        throw new Error(
          "SUPABASE_STORAGE_KEY or SUPABASE_ANON_KEY environment variable is not set",
        );
      }

      // Execute backup script
      const { stdout, stderr } = await execAsync(
        `bash "${this.backupScriptPath}" "${backupName}"`,
        {
          env: {
            ...process.env,
            DATABASE_URL: process.env.DATABASE_URL,
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_STORAGE_KEY: process.env.SUPABASE_STORAGE_KEY,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
            SUPABASE_BACKUP_BUCKET:
              process.env.SUPABASE_BACKUP_BUCKET || "database-backups",
            DB_BACKUP_RETENTION_DAYS:
              process.env.DB_BACKUP_RETENTION_DAYS || "30",
            BACKUP_DIR: process.env.BACKUP_DIR || "/tmp/backups",
          },
          timeout: 300000, // 5 minute timeout
        },
      );

      if (stdout) {
        this.logger.debug(
          createLogContext(this.contextService, "runBackup", {
            backupName,
            stdout,
          }),
          "Backup script output",
        );
      }

      if (stderr) {
        this.logger.warn(
          createLogContext(this.contextService, "runBackup", {
            backupName,
            stderr,
          }),
          "Backup script warnings",
        );
      }

      this.logger.info(
        createLogContext(this.contextService, "runBackup", {
          backupName,
        }),
        "Database backup completed successfully",
      );
    } catch (error) {
      this.logger.error(
        createLogContext(this.contextService, "runBackup", {
          backupName,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }),
        "Database backup failed",
      );
      // Don't throw - allow service to continue and try again next time
    }
  }

  /**
   * Manually trigger a backup (for testing or on-demand backups)
   */
  async triggerBackup(): Promise<void> {
    await this.runBackup();
  }
}
