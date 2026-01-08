import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request as ExpressRequest } from "express";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PaginatedResponseDto } from "../../common/dto/pagination.dto";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { CreateMediaGroupDto } from "./dto/create-media-group.dto";
import { CreateMediaItemDto } from "./dto/create-media-item.dto";
import { MediaGroupResponseDto } from "./dto/media-group-response.dto";
import { MediaItemResponseDto } from "./dto/media-item-response.dto";
import { QueryMediaGroupsDto } from "./dto/query-media-groups.dto";
import { ReorderItemsDto } from "./dto/reorder-items.dto";
import { UpdateMediaGroupDto } from "./dto/update-media-group.dto";
import { UpdateMediaItemDto } from "./dto/update-media-item.dto";
import { MediaGroupsService } from "./media-groups.service";

interface AuthenticatedRequest extends ExpressRequest {
  user?: {
    id?: string;
    userId?: string;
    email?: string;
    role?: string;
  };
}

@ApiTags("admin")
@Controller("admin/media-groups")
@Roles("admin")
@ApiBearerAuth("JWT-auth")
export class AdminMediaGroupsController {
  constructor(private readonly mediaGroupsService: MediaGroupsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({
    summary: "Create a new media group",
    description: "Create a new media group (admin only)",
  })
  @ApiCreatedResponse({
    description: "Media group created successfully",
    type: MediaGroupResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or duplicate name/slug",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() createDto: CreateMediaGroupDto,
  ): Promise<MediaGroupResponseDto> {
    const userId = req.user?.id || req.user?.userId;
    return this.mediaGroupsService.createGroup(createDto, userId);
  }

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all media groups",
    description: "Retrieve a paginated list of media groups (admin only)",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 10, max: 100)",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search query (searches in name and description)",
  })
  @ApiQuery({
    name: "isActive",
    required: false,
    type: Boolean,
    description: "Filter by active status",
  })
  @ApiOkResponse({
    description: "List of media groups retrieved successfully",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async findAll(
    @Query() query: QueryMediaGroupsDto,
  ): Promise<PaginatedResponseDto<MediaGroupResponseDto>> {
    return this.mediaGroupsService.findAll(query);
  }

  @Get(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get media group by ID",
    description: "Retrieve a single media group by its ID (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Media group ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Media group retrieved successfully",
    type: MediaGroupResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Media group not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async findOne(@Param("id") id: string): Promise<MediaGroupResponseDto> {
    return this.mediaGroupsService.findOne(id);
  }

  @Put(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Update a media group",
    description: "Update an existing media group (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Media group ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Media group updated successfully",
    type: MediaGroupResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Media group not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input or duplicate name/slug",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() updateDto: UpdateMediaGroupDto,
  ): Promise<MediaGroupResponseDto> {
    const userId = req.user?.id || req.user?.userId;
    return this.mediaGroupsService.updateGroup(id, updateDto, userId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Delete a media group",
    description:
      "Delete a media group and all its items (admin only). This action cannot be undone.",
  })
  @ApiParam({
    name: "id",
    description: "Media group ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Media group deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Media group deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Media group not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async remove(@Param("id") id: string) {
    await this.mediaGroupsService.deleteGroup(id);
    return { message: "Media group deleted successfully" };
  }

  @Post(":groupId/items")
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({
    summary: "Add image to media group",
    description:
      "Add an image item to a media group. Image should be uploaded via /admin/storage/upload first (admin only)",
  })
  @ApiParam({
    name: "groupId",
    description: "Media group ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiCreatedResponse({
    description: "Media item created successfully",
    type: MediaItemResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Media group not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async addItem(
    @Request() req: AuthenticatedRequest,
    @Param("groupId") groupId: string,
    @Body() createDto: CreateMediaItemDto,
  ): Promise<MediaItemResponseDto> {
    const userId = req.user?.id || req.user?.userId;
    return this.mediaGroupsService.addItem({ ...createDto, groupId }, userId);
  }

  @Get(":groupId/items")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all items in a media group",
    description: "Retrieve all image items in a media group (admin only)",
  })
  @ApiParam({
    name: "groupId",
    description: "Media group ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "activeOnly",
    required: false,
    type: Boolean,
    description: "Filter to only active items (default: false)",
  })
  @ApiOkResponse({
    description: "List of media items retrieved successfully",
    type: [MediaItemResponseDto],
  })
  @ApiNotFoundResponse({
    description: "Media group not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async getItems(
    @Param("groupId") groupId: string,
    @Query("activeOnly") activeOnly?: string,
  ): Promise<MediaItemResponseDto[]> {
    const activeOnlyBool = activeOnly === "true";
    return this.mediaGroupsService.findByGroup(groupId, activeOnlyBool);
  }

  @Put("items/:id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Update a media item",
    description: "Update an existing media item (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Media item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Media item updated successfully",
    type: MediaItemResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Media item not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async updateItem(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() updateDto: UpdateMediaItemDto,
  ): Promise<MediaItemResponseDto> {
    const userId = req.user?.id || req.user?.userId;
    return this.mediaGroupsService.updateItem(id, updateDto, userId);
  }

  @Delete("items/:id")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Delete a media item",
    description: "Delete a media item from a group (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Media item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Media item deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Media item deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Media item not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async removeItem(@Param("id") id: string) {
    await this.mediaGroupsService.deleteItem(id);
    return { message: "Media item deleted successfully" };
  }

  @Put(":groupId/reorder")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Reorder items in a media group",
    description:
      "Reorder items in a media group by providing an array of item IDs in the desired order (admin only)",
  })
  @ApiParam({
    name: "groupId",
    description: "Media group ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Items reordered successfully",
    type: [MediaItemResponseDto],
  })
  @ApiNotFoundResponse({
    description: "Media group not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid item IDs or items don't belong to group",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async reorderItems(
    @Param("groupId") groupId: string,
    @Body() reorderDto: ReorderItemsDto,
  ): Promise<MediaItemResponseDto[]> {
    return this.mediaGroupsService.reorderItems(groupId, reorderDto);
  }
}
