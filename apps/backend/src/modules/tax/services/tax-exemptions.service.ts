import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq, taxExemptions } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  CreateTaxExemptionDto,
  TaxExemptionResponseDto,
  UpdateTaxExemptionDto,
} from "../dto/tax-exemptions.dto";

@Injectable()
export class TaxExemptionsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Create a new tax exemption
   */
  async create(
    createDto: CreateTaxExemptionDto,
  ): Promise<TaxExemptionResponseDto> {
    // Check if name already exists
    const [existing] = await this.db
      .select()
      .from(taxExemptions)
      .where(eq(taxExemptions.name, createDto.name))
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        `Tax exemption with name '${createDto.name}' already exists`,
      );
    }

    const [newExemption] = await this.db
      .insert(taxExemptions)
      .values({
        name: createDto.name,
        description: createDto.description || null,
        exemptionType: createDto.exemptionType,
        entityId: createDto.entityId,
        exemptionReason: createDto.exemptionReason || null,
        certificateNumber: createDto.certificateNumber || null,
        isActive:
          createDto.isActive !== undefined ? (createDto.isActive ? 1 : 0) : 1,
        startDate: createDto.startDate ? new Date(createDto.startDate) : null,
        endDate: createDto.endDate ? new Date(createDto.endDate) : null,
      })
      .returning();

    this.logger.info(
      createLogContext(this.contextService, "create", {
        taxExemptionId: newExemption.id,
        exemptionType: createDto.exemptionType,
      }),
      "Created tax exemption",
    );

    return this.mapToResponseDto(newExemption);
  }

  /**
   * Get all tax exemptions
   */
  async findAll(): Promise<TaxExemptionResponseDto[]> {
    const exemptions = await this.db.select().from(taxExemptions);
    return exemptions.map((exemption) => this.mapToResponseDto(exemption));
  }

  /**
   * Get active tax exemptions
   */
  async findActive(): Promise<TaxExemptionResponseDto[]> {
    const exemptions = await this.db
      .select()
      .from(taxExemptions)
      .where(eq(taxExemptions.isActive, 1));
    return exemptions.map((exemption) => this.mapToResponseDto(exemption));
  }

  /**
   * Get tax exemption by ID
   */
  async findOne(id: string): Promise<TaxExemptionResponseDto> {
    const [exemption] = await this.db
      .select()
      .from(taxExemptions)
      .where(eq(taxExemptions.id, id))
      .limit(1);

    if (!exemption) {
      throw new NotFoundException(`Tax exemption with ID ${id} not found`);
    }

    return this.mapToResponseDto(exemption);
  }

  /**
   * Update tax exemption
   */
  async update(
    id: string,
    updateDto: UpdateTaxExemptionDto,
  ): Promise<TaxExemptionResponseDto> {
    const [existing] = await this.db
      .select()
      .from(taxExemptions)
      .where(eq(taxExemptions.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Tax exemption with ID ${id} not found`);
    }

    // Check name uniqueness if name is being updated
    if (updateDto.name && updateDto.name !== existing.name) {
      const [nameConflict] = await this.db
        .select()
        .from(taxExemptions)
        .where(eq(taxExemptions.name, updateDto.name))
        .limit(1);

      if (nameConflict) {
        throw new BadRequestException(
          `Tax exemption with name '${updateDto.name}' already exists`,
        );
      }
    }

    const updateData: Partial<typeof taxExemptions.$inferInsert> = {};
    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description || null;
    if (updateDto.exemptionReason !== undefined)
      updateData.exemptionReason = updateDto.exemptionReason || null;
    if (updateDto.certificateNumber !== undefined)
      updateData.certificateNumber = updateDto.certificateNumber || null;
    if (updateDto.isActive !== undefined)
      updateData.isActive = updateDto.isActive ? 1 : 0;
    if (updateDto.startDate !== undefined)
      updateData.startDate = updateDto.startDate
        ? new Date(updateDto.startDate)
        : null;
    if (updateDto.endDate !== undefined)
      updateData.endDate = updateDto.endDate
        ? new Date(updateDto.endDate)
        : null;

    await this.db
      .update(taxExemptions)
      .set(updateData)
      .where(eq(taxExemptions.id, id));

    this.logger.info(
      createLogContext(this.contextService, "update", {
        taxExemptionId: id,
        updates: updateDto,
      }),
      "Updated tax exemption",
    );

    return this.findOne(id);
  }

  /**
   * Delete tax exemption (soft delete by setting isActive to false)
   */
  async remove(id: string): Promise<{ message: string }> {
    const [existing] = await this.db
      .select()
      .from(taxExemptions)
      .where(eq(taxExemptions.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Tax exemption with ID ${id} not found`);
    }

    await this.db
      .update(taxExemptions)
      .set({ isActive: 0 })
      .where(eq(taxExemptions.id, id));

    this.logger.info(
      createLogContext(this.contextService, "remove", {
        taxExemptionId: id,
      }),
      "Deleted tax exemption",
    );

    return { message: "Tax exemption deleted successfully" };
  }

  /**
   * Map database record to response DTO
   */
  private mapToResponseDto(
    exemption: typeof taxExemptions.$inferSelect,
  ): TaxExemptionResponseDto {
    return {
      id: exemption.id,
      name: exemption.name,
      description: exemption.description,
      exemptionType:
        exemption.exemptionType as TaxExemptionResponseDto["exemptionType"],
      entityId: exemption.entityId,
      exemptionReason: exemption.exemptionReason,
      certificateNumber: exemption.certificateNumber,
      isActive: exemption.isActive === 1,
      startDate: exemption.startDate,
      endDate: exemption.endDate,
      createdAt: exemption.createdAt,
      updatedAt: exemption.updatedAt,
    };
  }
}
