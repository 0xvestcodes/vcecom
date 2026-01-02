import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq, themeSettings } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { z } from "zod";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import { DB_TOKEN } from "../database/database.module";
import type { Database } from "../database/db";
import { ThemeResponseDto } from "./dto/theme-response.dto";
import { UpdateThemeDto, updateThemeSchema } from "./dto/update-theme.dto";

@Injectable()
export class ThemeService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Get theme settings for the default store
   * Creates default theme if none exists
   */
  async getTheme(storeId?: string): Promise<ThemeResponseDto> {
    try {
      // For v1, we'll use the first store or create default
      // In multi-store setup, storeId would be required
      let theme;

      if (storeId) {
        [theme] = await this.db
          .select()
          .from(themeSettings)
          .where(eq(themeSettings.storeId, storeId))
          .limit(1);
      } else {
        // Get first theme (v1: single store assumption)
        [theme] = await this.db.select().from(themeSettings).limit(1);
      }

      if (!theme) {
        // Create default theme
        return this.createDefaultTheme();
      }

      return {
        colors: theme.colors as ThemeResponseDto["colors"],
        sectionPadding:
          theme.sectionPadding as ThemeResponseDto["sectionPadding"],
        globalRadius: theme.globalRadius as ThemeResponseDto["globalRadius"],
        typography: theme.typography as ThemeResponseDto["typography"],
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getTheme", error),
        "Failed to get theme",
      );
      throw error;
    }
  }

  /**
   * Update theme settings
   */
  async updateTheme(
    dto: UpdateThemeDto,
    adminId: string,
    storeId?: string,
  ): Promise<ThemeResponseDto> {
    try {
      // Validate DTO
      const validated = updateThemeSchema.parse(dto);

      // Get or create theme
      let theme;
      if (storeId) {
        [theme] = await this.db
          .select()
          .from(themeSettings)
          .where(eq(themeSettings.storeId, storeId))
          .limit(1);
      } else {
        [theme] = await this.db.select().from(themeSettings).limit(1);
      }

      if (theme) {
        // Update existing
        const [updated] = await this.db
          .update(themeSettings)
          .set({
            colors: validated.colors,
            sectionPadding: validated.sectionPadding,
            globalRadius: validated.globalRadius,
            typography: validated.typography,
            updatedAt: new Date(),
          })
          .where(eq(themeSettings.id, theme.id))
          .returning();

        return {
          colors: updated.colors as ThemeResponseDto["colors"],
          sectionPadding:
            updated.sectionPadding as ThemeResponseDto["sectionPadding"],
          globalRadius:
            updated.globalRadius as ThemeResponseDto["globalRadius"],
          typography: updated.typography as ThemeResponseDto["typography"],
        };
      } else {
        // Create new theme
        // For v1, we'll need to get the default store
        // For now, create without storeId (can be updated later)
        const [created] = await this.db
          .insert(themeSettings)
          .values({
            colors: validated.colors,
            sectionPadding: validated.sectionPadding,
            globalRadius: validated.globalRadius,
            typography: validated.typography,
            storeId: storeId || null,
          })
          .returning();

        return {
          colors: created.colors as ThemeResponseDto["colors"],
          sectionPadding:
            created.sectionPadding as ThemeResponseDto["sectionPadding"],
          globalRadius:
            created.globalRadius as ThemeResponseDto["globalRadius"],
          typography: created.typography as ThemeResponseDto["typography"],
        };
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "updateTheme", error),
        "Failed to update theme",
      );
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map((issue) => {
          const path = issue.path.join(".");
          return path ? `${path}: ${issue.message}` : issue.message;
        });
        throw new BadRequestException(
          `Invalid theme data: ${errorMessages.join(", ")}`,
        );
      }
      throw error;
    }
  }

  /**
   * Generate CSS from theme settings
   */
  generateCSS(theme: ThemeResponseDto): string {
    const spacingValue = this.getSpacingValue(theme.sectionPadding);
    const radiusValue = this.getRadiusValue(theme.globalRadius);

    return `
:root {
  --primary: ${theme.colors.primary};
  --secondary: ${theme.colors.secondary};
  --accent: ${theme.colors.accent};
  --background: ${theme.colors.background};
  --foreground: ${theme.colors.foreground};
  
  --section-padding: ${spacingValue};
  --radius: ${radiusValue};
  
  --font-sans: ${theme.typography.fontSans};
  --font-serif: ${theme.typography.fontSerif};
}
`.trim();
  }

  /**
   * Create default theme settings
   */
  private async createDefaultTheme(): Promise<ThemeResponseDto> {
    const defaultTheme: ThemeResponseDto = {
      colors: {
        primary: "oklch(0.7686 0.1647 70.0804)",
        secondary: "oklch(0.967 0.0029 264.5419)",
        accent: "oklch(0.9869 0.0214 95.2774)",
        background: "oklch(1 0 0)",
        foreground: "oklch(0.2686 0 0)",
      },
      sectionPadding: "md",
      globalRadius: "md",
      typography: {
        fontSans: "Inter, sans-serif",
        fontSerif: "Source Serif 4, serif",
      },
    };

    // Optionally save to DB, but for v1 we'll just return it
    return defaultTheme;
  }

  /**
   * Get spacing value in rem
   */
  private getSpacingValue(size: string): string {
    const map: Record<string, string> = {
      xs: "0.5rem",
      sm: "0.75rem",
      md: "1rem",
      lg: "1.5rem",
      xl: "2rem",
    };
    return map[size] || "1rem";
  }

  /**
   * Get radius value
   */
  private getRadiusValue(size: string): string {
    const map: Record<string, string> = {
      none: "0",
      sm: "0.25rem",
      md: "0.5rem",
      lg: "0.75rem",
      full: "9999px",
    };
    return map[size] || "0.5rem";
  }
}
