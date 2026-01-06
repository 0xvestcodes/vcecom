import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq, hsnCodes } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  normalizeHsnCode,
  validateHsnCodeFormat,
} from "../engine/hsn-validator";

/**
 * Service for managing HSN codes
 */
@Injectable()
export class HsnManagementService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Create a new HSN code
   */
  async create(params: {
    hsnCode: string;
    description?: string;
    gstRate?: number;
  }): Promise<typeof hsnCodes.$inferSelect> {
    // Validate and normalize HSN code
    const normalizedHsn = normalizeHsnCode(params.hsnCode);
    if (!normalizedHsn) {
      throw new BadRequestException(
        `Invalid HSN code format. Expected 8-digit numeric code.`,
      );
    }

    // Check if HSN code already exists
    const [existing] = await this.db
      .select()
      .from(hsnCodes)
      .where(eq(hsnCodes.hsnCode, normalizedHsn))
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        `HSN code '${normalizedHsn}' already exists`,
      );
    }

    // Validate GST rate if provided
    if (params.gstRate !== undefined) {
      if (params.gstRate < 0 || params.gstRate > 100) {
        throw new BadRequestException("GST rate must be between 0 and 100");
      }
    }

    const [newHsn] = await this.db
      .insert(hsnCodes)
      .values({
        hsnCode: normalizedHsn,
        description: params.description || null,
        gstRate: params.gstRate !== undefined ? params.gstRate : null,
        isActive: 1,
      })
      .returning();

    this.logger.info(
      createLogContext(this.contextService, "create", {
        hsnCodeId: newHsn.id,
        hsnCode: normalizedHsn,
      }),
      "Created HSN code",
    );

    return newHsn;
  }

  /**
   * Get all HSN codes
   */
  async findAll(): Promise<Array<typeof hsnCodes.$inferSelect>> {
    return this.db.select().from(hsnCodes);
  }

  /**
   * Get active HSN codes
   */
  async findActive(): Promise<Array<typeof hsnCodes.$inferSelect>> {
    return this.db.select().from(hsnCodes).where(eq(hsnCodes.isActive, 1));
  }

  /**
   * Get HSN code by ID
   */
  async findOne(id: string): Promise<typeof hsnCodes.$inferSelect> {
    const [hsn] = await this.db
      .select()
      .from(hsnCodes)
      .where(eq(hsnCodes.id, id))
      .limit(1);

    if (!hsn) {
      throw new NotFoundException(`HSN code with ID ${id} not found`);
    }

    return hsn;
  }

  /**
   * Get HSN code by code
   */
  async findByCode(code: string): Promise<typeof hsnCodes.$inferSelect | null> {
    const normalizedHsn = normalizeHsnCode(code);
    if (!normalizedHsn) {
      return null;
    }

    const [hsn] = await this.db
      .select()
      .from(hsnCodes)
      .where(eq(hsnCodes.hsnCode, normalizedHsn))
      .limit(1);

    return hsn || null;
  }

  /**
   * Update HSN code
   */
  async update(
    id: string,
    params: {
      description?: string;
      gstRate?: number;
      isActive?: boolean;
    },
  ): Promise<typeof hsnCodes.$inferSelect> {
    const [existing] = await this.db
      .select()
      .from(hsnCodes)
      .where(eq(hsnCodes.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`HSN code with ID ${id} not found`);
    }

    // Validate GST rate if provided
    if (params.gstRate !== undefined) {
      if (params.gstRate < 0 || params.gstRate > 100) {
        throw new BadRequestException("GST rate must be between 0 and 100");
      }
    }

    const updateData: Partial<typeof hsnCodes.$inferInsert> = {};
    if (params.description !== undefined)
      updateData.description = params.description || null;
    if (params.gstRate !== undefined) updateData.gstRate = params.gstRate;
    if (params.isActive !== undefined)
      updateData.isActive = params.isActive ? 1 : 0;

    await this.db.update(hsnCodes).set(updateData).where(eq(hsnCodes.id, id));

    this.logger.info(
      createLogContext(this.contextService, "update", {
        hsnCodeId: id,
        updates: params,
      }),
      "Updated HSN code",
    );

    return this.findOne(id);
  }

  /**
   * Delete HSN code (soft delete by setting isActive to false)
   */
  async remove(id: string): Promise<{ message: string }> {
    const [existing] = await this.db
      .select()
      .from(hsnCodes)
      .where(eq(hsnCodes.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`HSN code with ID ${id} not found`);
    }

    await this.db
      .update(hsnCodes)
      .set({ isActive: 0 })
      .where(eq(hsnCodes.id, id));

    this.logger.info(
      createLogContext(this.contextService, "remove", {
        hsnCodeId: id,
      }),
      "Deleted HSN code",
    );

    return { message: "HSN code deleted successfully" };
  }

  /**
   * Validate HSN code format
   */
  validateHsnCode(hsnCode: string): boolean {
    return validateHsnCodeFormat(hsnCode);
  }
}
