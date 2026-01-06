import { Inject, Injectable } from "@nestjs/common";
import { and, currencies, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { DB_TOKEN } from "../database/database.module";
import type { Database } from "../database/db";
import {
  CreateCurrencyDto,
  CurrencyResponseDto,
  UpdateCurrencyDto,
} from "./dto/currency.dto";

/**
 * Currency Service
 * Handles CRUD operations for currencies
 */
@Injectable()
export class CurrencyService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get all currencies
   */
  async findAll(): Promise<CurrencyResponseDto[]> {
    try {
      const results = await this.db
        .select()
        .from(currencies)
        .orderBy(currencies.code);

      return results.map(this.mapToResponseDto);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "findAll", error),
        "Failed to fetch currencies",
      );
      throw error;
    }
  }

  /**
   * Get active currencies
   */
  async findActive(): Promise<CurrencyResponseDto[]> {
    try {
      const results = await this.db
        .select()
        .from(currencies)
        .where(eq(currencies.isActive, true))
        .orderBy(currencies.code);

      return results.map(this.mapToResponseDto);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "findActive", error),
        "Failed to fetch active currencies",
      );
      throw error;
    }
  }

  /**
   * Get currency by ID
   */
  async findOne(id: string): Promise<CurrencyResponseDto | null> {
    try {
      const [result] = await this.db
        .select()
        .from(currencies)
        .where(eq(currencies.id, id))
        .limit(1);

      return result ? this.mapToResponseDto(result) : null;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "findOne", error, { id }),
        "Failed to fetch currency",
      );
      throw error;
    }
  }

  /**
   * Get currency by code
   */
  async findByCode(code: string): Promise<CurrencyResponseDto | null> {
    try {
      const [result] = await this.db
        .select()
        .from(currencies)
        .where(eq(currencies.code, code.toUpperCase()))
        .limit(1);

      return result ? this.mapToResponseDto(result) : null;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "findByCode", error, { code }),
        "Failed to fetch currency by code",
      );
      throw error;
    }
  }

  /**
   * Get default currency
   */
  async findDefault(): Promise<CurrencyResponseDto | null> {
    try {
      const [result] = await this.db
        .select()
        .from(currencies)
        .where(eq(currencies.isDefault, true))
        .limit(1);

      return result ? this.mapToResponseDto(result) : null;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "findDefault", error),
        "Failed to fetch default currency",
      );
      throw error;
    }
  }

  /**
   * Create a new currency
   */
  async create(dto: CreateCurrencyDto): Promise<CurrencyResponseDto> {
    try {
      // Validate currency code (ISO 4217 format: 3 uppercase letters)
      const code = dto.code.toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        throw new Error(
          "Invalid currency code. Must be 3 uppercase letters (ISO 4217)",
        );
      }

      // Check if currency already exists
      const existing = await this.findByCode(code);
      if (existing) {
        throw new Error(`Currency with code ${code} already exists`);
      }

      // If setting as default, unset other defaults
      if (dto.isDefault) {
        await this.unsetDefault();
      }

      const [created] = await this.db
        .insert(currencies)
        .values({
          code,
          name: dto.name,
          symbol: dto.symbol,
          isActive: dto.isActive ?? true,
          isDefault: dto.isDefault ?? false,
          decimalPlaces: dto.decimalPlaces ?? 2,
        })
        .returning();

      this.logger.info(
        createLogContext(this.contextService, "create", {
          code,
          id: created.id,
        }),
        "Currency created",
      );

      return this.mapToResponseDto(created);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "create", error, { dto }),
        "Failed to create currency",
      );
      throw error;
    }
  }

  /**
   * Update currency
   */
  async update(
    id: string,
    dto: UpdateCurrencyDto,
  ): Promise<CurrencyResponseDto> {
    try {
      // If setting as default, unset other defaults
      if (dto.isDefault) {
        await this.unsetDefault(id);
      }

      const [updated] = await this.db
        .update(currencies)
        .set({
          ...(dto.name && { name: dto.name }),
          ...(dto.symbol && { symbol: dto.symbol }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
          ...(dto.decimalPlaces !== undefined && {
            decimalPlaces: dto.decimalPlaces,
          }),
          updatedAt: new Date(),
        })
        .where(eq(currencies.id, id))
        .returning();

      if (!updated) {
        throw new Error(`Currency with id ${id} not found`);
      }

      this.logger.info(
        createLogContext(this.contextService, "update", { id }),
        "Currency updated",
      );

      return this.mapToResponseDto(updated);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "update", error, { id, dto }),
        "Failed to update currency",
      );
      throw error;
    }
  }

  /**
   * Delete currency
   */
  async delete(id: string): Promise<void> {
    try {
      const currency = await this.findOne(id);
      if (!currency) {
        throw new Error(`Currency with id ${id} not found`);
      }

      // Prevent deletion of default currency
      if (currency.isDefault) {
        throw new Error("Cannot delete default currency");
      }

      await this.db.delete(currencies).where(eq(currencies.id, id));

      this.logger.info(
        createLogContext(this.contextService, "delete", { id }),
        "Currency deleted",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "delete", error, { id }),
        "Failed to delete currency",
      );
      throw error;
    }
  }

  /**
   * Set currency as default
   */
  async setDefault(id: string): Promise<CurrencyResponseDto> {
    try {
      // Unset other defaults
      await this.unsetDefault(id);

      const [updated] = await this.db
        .update(currencies)
        .set({
          isDefault: true,
          updatedAt: new Date(),
        })
        .where(eq(currencies.id, id))
        .returning();

      if (!updated) {
        throw new Error(`Currency with id ${id} not found`);
      }

      this.logger.info(
        createLogContext(this.contextService, "setDefault", { id }),
        "Default currency set",
      );

      return this.mapToResponseDto(updated);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "setDefault", error, { id }),
        "Failed to set default currency",
      );
      throw error;
    }
  }

  /**
   * Unset default flag for all currencies except the specified one
   */
  private async unsetDefault(exceptId?: string): Promise<void> {
    const conditions = [eq(currencies.isDefault, true)];
    if (exceptId) {
      conditions.push(eq(currencies.id, exceptId));
    }

    await this.db
      .update(currencies)
      .set({
        isDefault: false,
        updatedAt: new Date(),
      })
      .where(
        exceptId
          ? and(eq(currencies.isDefault, true), eq(currencies.id, exceptId))
          : eq(currencies.isDefault, true),
      );
  }

  /**
   * Map database record to response DTO
   */
  private mapToResponseDto(
    record: typeof currencies.$inferSelect,
  ): CurrencyResponseDto {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      symbol: record.symbol,
      isActive: record.isActive,
      isDefault: record.isDefault,
      decimalPlaces: record.decimalPlaces,
      exchangeRate: record.exchangeRate ?? null,
      lastUpdated: record.lastUpdated ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
