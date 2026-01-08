import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { MediaGroupResponseDto } from "./dto/media-group-response.dto";
import { MediaItemResponseDto } from "./dto/media-item-response.dto";
import { MediaGroupsService } from "./media-groups.service";

@ApiTags("store")
@Controller("store/media-groups")
@Public()
export class StorefrontMediaGroupsController {
  constructor(private readonly mediaGroupsService: MediaGroupsService) {}

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "List all active media groups",
    description: "Retrieve a list of all active media groups (public endpoint)",
  })
  @ApiOkResponse({
    description: "List of active media groups retrieved successfully",
    type: [MediaGroupResponseDto],
  })
  async findAll(): Promise<MediaGroupResponseDto[]> {
    return this.mediaGroupsService.findActiveGroups();
  }

  @Get(":slug")
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get media group by slug with images",
    description:
      "Retrieve a media group by slug with all active images (public endpoint)",
  })
  @ApiParam({
    name: "slug",
    description: "Media group slug",
    example: "banners",
  })
  @ApiOkResponse({
    description: "Media group with images retrieved successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string", nullable: true },
        images: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              url: { type: "string" },
              altText: { type: "string", nullable: true },
              caption: { type: "string", nullable: true },
              linkUrl: { type: "string", nullable: true },
              displayOrder: { type: "number" },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Media group not found",
  })
  async findBySlug(@Param("slug") slug: string) {
    const group = await this.mediaGroupsService.findBySlug(slug);
    const images = await this.mediaGroupsService.findActiveByGroupSlug(slug);

    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      images: images.map((img) => ({
        id: img.id,
        url: img.url,
        altText: img.altText,
        caption: img.caption,
        linkUrl: img.linkUrl,
        displayOrder: img.displayOrder,
      })),
    };
  }

  @Get(":slug/images")
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get images for a media group",
    description:
      "Retrieve only the active images for a media group by slug (public endpoint)",
  })
  @ApiParam({
    name: "slug",
    description: "Media group slug",
    example: "banners",
  })
  @ApiOkResponse({
    description: "Images retrieved successfully",
    type: [MediaItemResponseDto],
  })
  @ApiNotFoundResponse({
    description: "Media group not found",
  })
  async getImages(
    @Param("slug") slug: string,
  ): Promise<MediaItemResponseDto[]> {
    return this.mediaGroupsService.findActiveByGroupSlug(slug);
  }
}
