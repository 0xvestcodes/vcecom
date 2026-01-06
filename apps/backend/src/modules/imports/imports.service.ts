import { Inject, Injectable } from "@nestjs/common";
import { eq, importJobErrors, importJobs } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { QueueService } from "../queue/queue.service";
import { StorageService } from "../storage/storage.service";
import {
  CreateImportJobDto,
  ImportJobResponseDto,
  ImportJobStatus,
  ImportJobStatusResponseDto,
  ImportSource,
  ImportType,
} from "./dto/imports.dto";
import { CsvParser } from "./parsers/csv.parser";
import { ExcelParser } from "./parsers/excel.parser";
import { JsonParser } from "./parsers/json.parser";
import { CategoryProcessor } from "./processors/category-processor";
import { CustomerProcessor } from "./processors/customer-processor";
import { InventoryProcessor } from "./processors/inventory-processor";
import { ProductProcessor } from "./processors/product-processor";
import { TemplateGeneratorService } from "./templates/template-generator.service";

@Injectable()
export class ImportsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
    private readonly csvParser: CsvParser,
    private readonly excelParser: ExcelParser,
    private readonly jsonParser: JsonParser,
    private readonly productProcessor: ProductProcessor,
    private readonly categoryProcessor: CategoryProcessor,
    private readonly inventoryProcessor: InventoryProcessor,
    private readonly customerProcessor: CustomerProcessor,
    private readonly templateGenerator: TemplateGeneratorService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Create a new import job
   */
  async createImportJob(
    dto: CreateImportJobDto,
    userId: string,
  ): Promise<ImportJobResponseDto> {
    try {
      // Upload file to storage if provided
      let fileUrl: string | undefined;
      if (dto.file) {
        const buffer = Buffer.from(dto.file.buffer);
        const key = `imports/${dto.type}/${Date.now()}-${dto.file.originalname}`;
        fileUrl = await this.storageService.upload(
          key,
          buffer,
          dto.file.mimetype,
        );
      }

      // Create import job record
      const [importJob] = await this.db
        .insert(importJobs)
        .values({
          type: dto.type,
          source: dto.source,
          status: "pending",
          fileUrl: fileUrl || null,
          totalRows: 0,
          processedRows: 0,
          successfulRows: 0,
          failedRows: 0,
          metadata: {
            fileName: dto.file?.originalname,
            fileSize: dto.file?.size,
            options: {
              skipErrors: dto.options?.skipErrors ?? false,
              updateExisting: dto.options?.updateExisting ?? false,
              dryRun: dto.options?.dryRun ?? false,
            },
          },
          createdBy: userId,
        })
        .returning();

      // Enqueue job for processing
      await this.queueService.addJob(
        "imports",
        "process-import",
        { jobId: importJob.id },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      );

      return {
        id: importJob.id,
        type: importJob.type as ImportType,
        source: importJob.source as ImportSource,
        status: importJob.status as ImportJobStatus,
        fileUrl: importJob.fileUrl || undefined,
        totalRows: importJob.totalRows ?? 0,
        processedRows: importJob.processedRows ?? 0,
        successfulRows: importJob.successfulRows ?? 0,
        failedRows: importJob.failedRows ?? 0,
        createdAt: importJob.createdAt,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "createImportJob", error, {
          dto,
          userId,
        }),
        "Failed to create import job",
      );
      throw error;
    }
  }

  /**
   * Get import job status
   */
  async getImportJobStatus(jobId: string): Promise<ImportJobStatusResponseDto> {
    const [job] = await this.db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, jobId))
      .limit(1);

    if (!job) {
      throw new Error(`Import job with ID ${jobId} not found`);
    }

    // Get error count
    const errorCount = await this.db
      .select({ count: importJobErrors.id })
      .from(importJobErrors)
      .where(eq(importJobErrors.importJobId, jobId));

    return {
      id: job.id,
      type: job.type as ImportType,
      source: job.source as ImportSource,
      status: job.status as ImportJobStatus,
      totalRows: job.totalRows ?? 0,
      processedRows: job.processedRows ?? 0,
      successfulRows: job.successfulRows ?? 0,
      failedRows: job.failedRows ?? 0,
      errorCount: errorCount.length,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt || undefined,
    };
  }

  /**
   * Process import job (called by background job processor)
   */
  async processImportJob(jobId: string): Promise<void> {
    const [job] = await this.db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, jobId))
      .limit(1);

    if (!job) {
      throw new Error(`Import job with ID ${jobId} not found`);
    }

    // Update status to processing
    await this.db
      .update(importJobs)
      .set({
        status: "processing",
        updatedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId));

    try {
      // Download file from storage URL
      if (!job.fileUrl) {
        throw new Error("File URL is missing");
      }

      // Fetch file from storage URL
      const response = await fetch(job.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      // Parse file based on source
      let parseResult: {
        headers: string[];
        rows: Array<{ rowNumber: number; data: Record<string, string> }>;
        totalRows: number;
      };

      switch (job.source) {
        case "csv":
          parseResult = await this.csvParser.parse(fileBuffer);
          break;
        case "excel":
          parseResult = await this.excelParser.parse(fileBuffer);
          break;
        case "json":
          parseResult = await this.jsonParser.parse(fileBuffer);
          break;
        default:
          throw new Error(`Unsupported source: ${job.source}`);
      }

      // Update total rows
      await this.db
        .update(importJobs)
        .set({
          totalRows: parseResult.totalRows,
          updatedAt: new Date(),
        })
        .where(eq(importJobs.id, jobId));

      // Process each row
      const options = job.metadata?.options || {};
      let processedRows = 0;
      let successfulRows = 0;
      let failedRows = 0;

      for (const row of parseResult.rows) {
        try {
          const result = await this.processRow(
            job.type as ImportType,
            row.data,
            options,
          );

          if (result.success) {
            successfulRows++;
          } else {
            failedRows++;
            // Log error
            await this.db.insert(importJobErrors).values({
              importJobId: jobId,
              rowNumber: row.rowNumber,
              field: result.field || undefined,
              value: result.value || undefined,
              errorCode: result.errorCode || "PROCESSING_ERROR",
              errorMessage: result.error || "Unknown error",
              rawData: row.data,
            });
          }

          processedRows++;

          // Update progress every 10 rows
          if (processedRows % 10 === 0) {
            await this.db
              .update(importJobs)
              .set({
                processedRows,
                successfulRows,
                failedRows,
                updatedAt: new Date(),
              })
              .where(eq(importJobs.id, jobId));
          }
        } catch (error) {
          failedRows++;
          processedRows++;

          // Log error
          await this.db.insert(importJobErrors).values({
            importJobId: jobId,
            rowNumber: row.rowNumber,
            errorCode: "PROCESSING_ERROR",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            rawData: row.data,
          });
        }
      }

      // Final update
      await this.db
        .update(importJobs)
        .set({
          processedRows,
          successfulRows,
          failedRows,
          status: failedRows === processedRows ? "failed" : "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importJobs.id, jobId));
    } catch (error) {
      // Mark job as failed
      await this.db
        .update(importJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importJobs.id, jobId));

      this.logger.error(
        createErrorContext(this.contextService, "processImportJob", error, {
          jobId,
        }),
        "Failed to process import job",
      );
      throw error;
    }
  }

  /**
   * Process a single row based on import type
   */
  private async processRow(
    type: ImportType,
    row: Record<string, string>,
    options: {
      skipErrors?: boolean;
      updateExisting?: boolean;
      dryRun?: boolean;
      [key: string]: unknown;
    },
  ): Promise<{
    success: boolean;
    error?: string;
    field?: string;
    value?: string;
    errorCode?: string;
  }> {
    if (options.dryRun) {
      // In dry run mode, just validate without processing
      return { success: true };
    }

    let result:
      | {
          success: boolean;
          error?: string;
        }
      | undefined;

    switch (type) {
      case "products":
        result = await this.productProcessor.process(row, options);
        break;
      case "categories":
        result = await this.categoryProcessor.process(row, options);
        break;
      case "inventory":
        result = await this.inventoryProcessor.process(row, options);
        break;
      case "customers":
        result = await this.customerProcessor.process(row, options);
        break;
      default:
        return {
          success: false,
          error: `Unsupported import type: ${type}`,
          errorCode: "UNSUPPORTED_TYPE",
        };
    }

    if (!result.success && !options.skipErrors) {
      return {
        success: false,
        error: result.error,
        errorCode: "PROCESSING_ERROR",
      };
    }

    return result;
  }

  /**
   * Get import job errors
   */
  async getImportJobErrors(
    jobId: string,
    limit = 100,
    offset = 0,
  ): Promise<
    Array<{
      id: string;
      rowNumber: number;
      field: string | null;
      value: string | null;
      errorCode: string;
      errorMessage: string;
      rawData: unknown;
      createdAt: Date;
    }>
  > {
    return await this.db
      .select()
      .from(importJobErrors)
      .where(eq(importJobErrors.importJobId, jobId))
      .limit(limit)
      .offset(offset)
      .orderBy(importJobErrors.rowNumber);
  }

  /**
   * Generate import template
   */
  async generateTemplate(
    type: ImportType,
    format: "csv" | "excel",
  ): Promise<Buffer> {
    if (format === "excel") {
      return this.templateGenerator.generateExcelTemplate(type);
    }
    return this.templateGenerator.generateCsvTemplate(type);
  }
}
