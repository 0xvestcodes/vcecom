import { Injectable } from "@nestjs/common";
import { AppConfigService } from "./app.config.service";

/**
 * Sandbox Configuration Service
 * Manages sandbox mode for safe testing and development
 */
@Injectable()
export class SandboxConfigService {
  private sandboxEnabled: boolean;
  private sandboxMode: "readonly" | "full" | "disabled";

  constructor(private readonly appConfigService: AppConfigService) {
    // Enable sandbox mode in development/test environments
    const nodeEnv = this.appConfigService.getNodeEnv();
    this.sandboxEnabled =
      nodeEnv === "development" ||
      nodeEnv === "test" ||
      process.env.SANDBOX_ENABLED === "true";
    this.sandboxMode =
      (process.env.SANDBOX_MODE as "readonly" | "full" | "disabled") || "full";
  }

  /**
   * Check if sandbox mode is enabled
   */
  isSandboxEnabled(): boolean {
    return this.sandboxEnabled && this.sandboxMode !== "disabled";
  }

  /**
   * Check if sandbox is in readonly mode
   */
  isReadonlyMode(): boolean {
    return this.isSandboxEnabled() && this.sandboxMode === "readonly";
  }

  /**
   * Get sandbox mode
   */
  getSandboxMode(): "readonly" | "full" | "disabled" {
    return this.sandboxMode;
  }

  /**
   * Check if operation is allowed in sandbox mode
   */
  isOperationAllowed(operation: "read" | "write" | "delete"): boolean {
    if (!this.isSandboxEnabled()) {
      return true; // Not in sandbox, allow all
    }

    if (this.isReadonlyMode()) {
      return operation === "read";
    }

    return true; // Full sandbox mode allows all operations
  }

  /**
   * Get sandbox restrictions
   */
  getSandboxRestrictions(): {
    enabled: boolean;
    mode: string;
    restrictions: string[];
  } {
    const restrictions: string[] = [];

    if (this.isReadonlyMode()) {
      restrictions.push("Write operations are disabled");
      restrictions.push("Delete operations are disabled");
    }

    if (this.isSandboxEnabled()) {
      restrictions.push("All data changes are isolated to sandbox environment");
      restrictions.push("External API calls may be mocked");
    }

    return {
      enabled: this.isSandboxEnabled(),
      mode: this.sandboxMode,
      restrictions,
    };
  }
}
