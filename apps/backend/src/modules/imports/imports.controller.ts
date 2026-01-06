import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { User } from "../../common/decorators/user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import {
  CreateImportJobDto,
  ImportJobErrorResponseDto,
  ImportJobResponseDto,
  ImportJobStatusResponseDto,
  ImportSource,
  ImportType,
} from "./dto/imports.dto";
import { ImportsService } from "./imports.service";

@ApiTags("admin")
@Controller("admin/imports")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Create a new import job",
    description:
      "Upload a file and create an import job. Supported formats: CSV, Excel (.xlsx), JSON. The job will be processed asynchronously.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["type", "source"],
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "File to import (CSV, Excel, or JSON)",
        },
        type: {
          type: "string",
          enum: Object.values(ImportType),
          description: "Import type",
          example: ImportType.PRODUCTS,
        },
        source: {
          type: "string",
          enum: Object.values(ImportSource),
          description: "Import source",
          example: ImportSource.CSV,
        },
        options: {
          type: "object",
          description: "Import options",
          properties: {
            skipErrors: {
              type: "boolean",
              description: "Skip errors and continue processing",
              example: false,
            },
            updateExisting: {
              type: "boolean",
              description: "Update existing records instead of failing",
              example: false,
            },
            dryRun: {
              type: "boolean",
              description: "Dry run mode - validate without importing",
              example: false,
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "Import job created successfully",
    type: ImportJobResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - invalid file or parameters",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async createImportJob(
    @User() user: { id: string; email: string; role: string },
    @Body() dto: CreateImportJobDto,
  ): Promise<ImportJobResponseDto> {
    return this.importsService.createImportJob(dto, user.id);
  }

  @Get(":jobId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get import job status",
    description: "Get the current status and progress of an import job",
  })
  @ApiParam({
    name: "jobId",
    description: "Import job ID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Import job status retrieved successfully",
    type: ImportJobStatusResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Import job not found",
  })
  async getImportJobStatus(
    @Param("jobId") jobId: string,
  ): Promise<ImportJobStatusResponseDto> {
    return this.importsService.getImportJobStatus(jobId);
  }

  @Get(":jobId/errors")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get import job errors",
    description: "Get error logs for an import job",
  })
  @ApiParam({
    name: "jobId",
    description: "Import job ID",
    type: String,
  })
  @ApiQuery({
    name: "limit",
    description: "Maximum number of errors to return",
    type: Number,
    required: false,
    example: 100,
  })
  @ApiQuery({
    name: "offset",
    description: "Number of errors to skip",
    type: Number,
    required: false,
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: "Import job errors retrieved successfully",
    type: [ImportJobErrorResponseDto],
  })
  async getImportJobErrors(
    @Param("jobId") jobId: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ): Promise<ImportJobErrorResponseDto[]> {
    return this.importsService.getImportJobErrors(
      jobId,
      limit ? Number(limit) : 100,
      offset ? Number(offset) : 0,
    );
  }

  @Get("templates/:type")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Download import template",
    description: "Download CSV or Excel template for the specified import type",
  })
  @ApiParam({
    name: "type",
    description: "Import type",
    enum: ImportType,
  })
  @ApiQuery({
    name: "format",
    description: "Template format",
    enum: ["csv", "excel"],
    required: false,
    example: "csv",
  })
  @ApiResponse({
    status: 200,
    description: "Template file",
    content: {
      "text/csv": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  async downloadTemplate(
    @Param("type") type: ImportType,
    @Query("format") format: "csv" | "excel" = "csv",
  ): Promise<Buffer> {
    return this.importsService.generateTemplate(type, format);
  }
}
