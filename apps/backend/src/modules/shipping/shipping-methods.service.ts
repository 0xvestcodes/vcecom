import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, shippingMethods } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import {
  AvailableShippingMethod,
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
} from "./dto/shipping-methods.dto";
import { ShippingRulesService } from "./shipping-rules.service";

@Injectable()
export class ShippingMethodsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly shippingRulesService: ShippingRulesService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Create a new shipping method
   */
  async create(dto: CreateShippingMethodDto) {
    // Check if code already exists
    const existing = await this.db
      .select()
      .from(shippingMethods)
      .where(eq(shippingMethods.code, dto.code))
      .limit(1);

    if (existing.length > 0) {
      throw new BadRequestException(
        `Shipping method with code '${dto.code}' already exists`,
      );
    }

    const [method] = await this.db
      .insert(shippingMethods)
      .values({
        name: dto.name,
        description: dto.description || null,
        code: dto.code,
        baseRate: dto.baseRate,
        estimatedDays: dto.estimatedDays,
        codAvailable: dto.codAvailable ?? true,
        codCharge: dto.codCharge || null,
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 0,
        minOrderValue: dto.minOrderValue || null,
        maxOrderValue: dto.maxOrderValue || null,
        restrictedZones: dto.restrictedZones || null,
        restrictedStates: dto.restrictedStates || null,
      })
      .returning();

    this.logger.info(`Created shipping method: ${method.id} (${method.code})`);
    return method;
  }

  /**
   * Get all shipping methods
   */
  async findAll(includeInactive = false) {
    const conditions = includeInactive
      ? undefined
      : eq(shippingMethods.isActive, true);

    return await this.db
      .select()
      .from(shippingMethods)
      .where(conditions)
      .orderBy(desc(shippingMethods.priority), shippingMethods.name);
  }

  /**
   * Get a single shipping method by ID
   */
  async findOne(id: string) {
    const [method] = await this.db
      .select()
      .from(shippingMethods)
      .where(eq(shippingMethods.id, id))
      .limit(1);

    if (!method) {
      throw new NotFoundException(`Shipping method with ID ${id} not found`);
    }

    return method;
  }

  /**
   * Update a shipping method
   */
  async update(id: string, dto: UpdateShippingMethodDto) {
    // Check if method exists
    await this.findOne(id);

    // If code is being updated, check for duplicates
    if (dto.code) {
      const existing = await this.db
        .select()
        .from(shippingMethods)
        .where(
          and(eq(shippingMethods.code, dto.code), eq(shippingMethods.id, id)),
        )
        .limit(1);

      if (existing.length === 0) {
        // Check if another method has this code
        const duplicate = await this.db
          .select()
          .from(shippingMethods)
          .where(eq(shippingMethods.code, dto.code))
          .limit(1);

        if (duplicate.length > 0) {
          throw new BadRequestException(
            `Shipping method with code '${dto.code}' already exists`,
          );
        }
      }
    }

    const [updated] = await this.db
      .update(shippingMethods)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(shippingMethods.id, id))
      .returning();

    this.logger.info(`Updated shipping method: ${id}`);
    return updated;
  }

  /**
   * Delete a shipping method
   */
  async remove(id: string) {
    await this.findOne(id);

    await this.db.delete(shippingMethods).where(eq(shippingMethods.id, id));

    this.logger.info(`Deleted shipping method: ${id}`);
  }

  /**
   * Get available shipping methods for a given address and cart
   */
  async getAvailableMethods(params: {
    pincode: string;
    state?: string | null;
    cartTotal: number; // in paise
    cartWeight?: number; // in grams
    isCod?: boolean;
  }): Promise<AvailableShippingMethod[]> {
    const { pincode, state, cartTotal, isCod = false } = params;

    // Check serviceability
    const serviceability =
      await this.shippingRulesService.checkServiceability(pincode);

    if (!serviceability.isValid || !serviceability.isServiceable) {
      return [];
    }

    const zone = serviceability.shippingZone || "zone_c";

    // Get all active shipping methods
    const methods = await this.findAll(false);

    const availableMethods: AvailableShippingMethod[] = [];

    for (const method of methods) {
      // Check zone restrictions
      if (
        method.restrictedZones &&
        Array.isArray(method.restrictedZones) &&
        method.restrictedZones.includes(zone)
      ) {
        continue; // Skip this method
      }

      // Check state restrictions
      if (
        state &&
        method.restrictedStates &&
        Array.isArray(method.restrictedStates) &&
        method.restrictedStates.includes(state)
      ) {
        continue; // Skip this method
      }

      // Check order value restrictions
      if (method.minOrderValue && cartTotal < method.minOrderValue) {
        continue; // Skip this method
      }

      if (method.maxOrderValue && cartTotal > method.maxOrderValue) {
        continue; // Skip this method
      }

      // Check COD availability
      if (isCod && !method.codAvailable) {
        continue; // Skip this method
      }

      // Calculate final cost
      let cost = method.baseRate;

      // Add COD charge if applicable
      if (isCod && method.codCharge) {
        cost += method.codCharge;
      }

      // Optionally apply weight-based adjustments using shipping rules service
      // For now, we use the base rate from the method
      // In the future, this could integrate with shipping rules for weight-based pricing

      availableMethods.push({
        id: method.id,
        name: method.name,
        description: method.description,
        code: method.code,
        cost,
        estimatedDays: method.estimatedDays,
        codAvailable: method.codAvailable,
        codCharge: method.codCharge,
      });
    }

    // Sort by priority (descending) then by cost (ascending)
    availableMethods.sort((a, b) => {
      const methodA = methods.find((m) => m.id === a.id);
      const methodB = methods.find((m) => m.id === b.id);
      const priorityDiff = (methodB?.priority || 0) - (methodA?.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return a.cost - b.cost;
    });

    return availableMethods;
  }
}
