import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq, taxRules } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  CreateTaxRuleDto,
  TaxRuleResponseDto,
  UpdateTaxRuleDto,
} from "../dto/tax-rules.dto";

@Injectable()
export class TaxRulesService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Create a new tax rule
   */
  async create(createDto: CreateTaxRuleDto): Promise<TaxRuleResponseDto> {
    // Check if name already exists
    const [existing] = await this.db
      .select()
      .from(taxRules)
      .where(eq(taxRules.name, createDto.name))
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        `Tax rule with name '${createDto.name}' already exists`,
      );
    }

    const [newRule] = await this.db
      .insert(taxRules)
      .values({
        name: createDto.name,
        description: createDto.description || null,
        ruleType: createDto.ruleType,
        entityId: createDto.entityId,
        gstRate: createDto.gstRate,
        priority: createDto.priority || 1,
        isActive:
          createDto.isActive !== undefined ? (createDto.isActive ? 1 : 0) : 1,
        startDate: createDto.startDate ? new Date(createDto.startDate) : null,
        endDate: createDto.endDate ? new Date(createDto.endDate) : null,
      })
      .returning();

    this.logger.info(
      createLogContext(this.contextService, "create", {
        taxRuleId: newRule.id,
        ruleType: createDto.ruleType,
      }),
      "Created tax rule",
    );

    return this.mapToResponseDto(newRule);
  }

  /**
   * Get all tax rules
   */
  async findAll(): Promise<TaxRuleResponseDto[]> {
    const rules = await this.db.select().from(taxRules);
    return rules.map((rule) => this.mapToResponseDto(rule));
  }

  /**
   * Get active tax rules
   */
  async findActive(): Promise<TaxRuleResponseDto[]> {
    const rules = await this.db
      .select()
      .from(taxRules)
      .where(eq(taxRules.isActive, 1));
    return rules.map((rule) => this.mapToResponseDto(rule));
  }

  /**
   * Get tax rule by ID
   */
  async findOne(id: string): Promise<TaxRuleResponseDto> {
    const [rule] = await this.db
      .select()
      .from(taxRules)
      .where(eq(taxRules.id, id))
      .limit(1);

    if (!rule) {
      throw new NotFoundException(`Tax rule with ID ${id} not found`);
    }

    return this.mapToResponseDto(rule);
  }

  /**
   * Update tax rule
   */
  async update(
    id: string,
    updateDto: UpdateTaxRuleDto,
  ): Promise<TaxRuleResponseDto> {
    const [existing] = await this.db
      .select()
      .from(taxRules)
      .where(eq(taxRules.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Tax rule with ID ${id} not found`);
    }

    // Check name uniqueness if name is being updated
    if (updateDto.name && updateDto.name !== existing.name) {
      const [nameConflict] = await this.db
        .select()
        .from(taxRules)
        .where(eq(taxRules.name, updateDto.name))
        .limit(1);

      if (nameConflict) {
        throw new BadRequestException(
          `Tax rule with name '${updateDto.name}' already exists`,
        );
      }
    }

    const updateData: Partial<typeof taxRules.$inferInsert> = {};
    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description || null;
    if (updateDto.gstRate !== undefined) updateData.gstRate = updateDto.gstRate;
    if (updateDto.priority !== undefined)
      updateData.priority = updateDto.priority;
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

    await this.db.update(taxRules).set(updateData).where(eq(taxRules.id, id));

    this.logger.info(
      createLogContext(this.contextService, "update", {
        taxRuleId: id,
        updates: updateDto,
      }),
      "Updated tax rule",
    );

    return this.findOne(id);
  }

  /**
   * Delete tax rule (soft delete by setting isActive to false)
   */
  async remove(id: string): Promise<{ message: string }> {
    const [existing] = await this.db
      .select()
      .from(taxRules)
      .where(eq(taxRules.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Tax rule with ID ${id} not found`);
    }

    await this.db
      .update(taxRules)
      .set({ isActive: 0 })
      .where(eq(taxRules.id, id));

    this.logger.info(
      createLogContext(this.contextService, "remove", {
        taxRuleId: id,
      }),
      "Deleted tax rule",
    );

    return { message: "Tax rule deleted successfully" };
  }

  /**
   * Map database record to response DTO
   */
  private mapToResponseDto(
    rule: typeof taxRules.$inferSelect,
  ): TaxRuleResponseDto {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      ruleType: rule.ruleType as TaxRuleResponseDto["ruleType"],
      entityId: rule.entityId,
      gstRate: Number(rule.gstRate),
      priority: rule.priority,
      isActive: rule.isActive === 1,
      startDate: rule.startDate,
      endDate: rule.endDate,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
