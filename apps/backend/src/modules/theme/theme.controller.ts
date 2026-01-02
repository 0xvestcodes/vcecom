import { Body, Controller, Get, Header, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { User } from "../../common/decorators/user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { ThemeResponseDto } from "./dto/theme-response.dto";
import { UpdateThemeDto } from "./dto/update-theme.dto";
import { ThemeService } from "./theme.service";

@ApiTags("theme")
@Controller("theme")
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Get()
  @Public()
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get theme settings",
    description:
      "Returns theme configuration including colors, spacing, typography (public endpoint)",
  })
  @ApiOkResponse({
    description: "Theme settings retrieved successfully",
    type: Object,
  })
  async getTheme(): Promise<ThemeResponseDto> {
    return this.themeService.getTheme();
  }

  @Get("css")
  @Public()
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @Header("Content-Type", "text/css")
  @ApiOperation({
    summary: "Get theme CSS",
    description: "Returns CSS custom properties for theme (public endpoint)",
  })
  @ApiOkResponse({
    description: "Theme CSS retrieved successfully",
    content: {
      "text/css": {
        schema: {
          type: "string",
        },
      },
    },
  })
  async getThemeCSS(): Promise<string> {
    const theme = await this.themeService.getTheme();
    return this.themeService.generateCSS(theme);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Update theme settings",
    description: "Update theme configuration (admin only)",
  })
  @ApiOkResponse({
    description: "Theme settings updated successfully",
    type: Object,
  })
  async updateTheme(
    @Body() dto: UpdateThemeDto,
    @User() user: { id: string },
  ): Promise<ThemeResponseDto> {
    return this.themeService.updateTheme(dto, user.id);
  }
}
