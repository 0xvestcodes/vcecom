import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ChargeType,
  eq,
  PaymentMethod,
  paymentMethodCharges,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { PaymentChargeService } from "../payments/services/payment-charge.service";
import {
  CreatePaymentChargeDto,
  UpdatePaymentChargeDto,
} from "./dto/payment-charges.dto";

@Injectable()
export class PaymentChargesService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly paymentChargeService: PaymentChargeService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  async findAll() {
    const charges = await this.db
      .select()
      .from(paymentMethodCharges)
      .orderBy(paymentMethodCharges.method);

    // Convert paise to rupees for response
    return charges.map((charge) => ({
      ...charge,
      flatAmount: charge.flatAmount / 100,
      mixCap: charge.mixCap ? charge.mixCap / 100 : null,
      mixMin: charge.mixMin ? charge.mixMin / 100 : null,
      codMaxAmount: charge.codMaxAmount ? charge.codMaxAmount / 100 : null,
    }));
  }

  async findOne(id: string) {
    const [charge] = await this.db
      .select()
      .from(paymentMethodCharges)
      .where(eq(paymentMethodCharges.id, id))
      .limit(1);

    if (!charge) {
      throw new NotFoundException(`Payment charge with ID ${id} not found`);
    }

    // Convert paise to rupees for response
    return {
      ...charge,
      flatAmount: charge.flatAmount / 100,
      mixCap: charge.mixCap ? charge.mixCap / 100 : null,
      mixMin: charge.mixMin ? charge.mixMin / 100 : null,
      codMaxAmount: charge.codMaxAmount ? charge.codMaxAmount / 100 : null,
    };
  }

  async create(dto: CreatePaymentChargeDto) {
    // Validate charge type specific fields
    this.validateChargeType(dto);

    // Convert rupees to paise for storage (database stores in paise)
    const flatAmountInPaise = Math.round(dto.flatAmount * 100);
    const mixCapInPaise =
      dto.mixCap !== undefined ? Math.round(dto.mixCap * 100) : null;
    const mixMinInPaise =
      dto.mixMin !== undefined ? Math.round(dto.mixMin * 100) : null;
    const codMaxAmountInPaise =
      dto.codMaxAmount !== undefined
        ? Math.round(dto.codMaxAmount * 100)
        : null;

    const [charge] = await this.db
      .insert(paymentMethodCharges)
      .values({
        method: dto.method as unknown as PaymentMethod,
        chargeType: dto.chargeType as unknown as ChargeType,
        flatAmount: flatAmountInPaise,
        percentage: dto.percentage,
        mixCap: mixCapInPaise,
        mixMin: mixMinInPaise,
        isTaxable: dto.isTaxable ?? false,
        currency: dto.currency ?? "INR",
        codMaxAmount: codMaxAmountInPaise,
        codDisallowHighValue: dto.codDisallowHighValue ?? false,
        codDisallowDigital: dto.codDisallowDigital ?? true,
        codDisallowPreorder: dto.codDisallowPreorder ?? true,
        active: dto.active ?? true,
      })
      .returning();

    this.logger.info(
      { chargeId: charge.id, method: charge.method },
      "Payment charge created",
    );

    // Return charge with amounts converted back to rupees
    return {
      ...charge,
      flatAmount: charge.flatAmount / 100,
      mixCap: charge.mixCap ? charge.mixCap / 100 : null,
      mixMin: charge.mixMin ? charge.mixMin / 100 : null,
      codMaxAmount: charge.codMaxAmount ? charge.codMaxAmount / 100 : null,
    };
  }

  async update(id: string, dto: UpdatePaymentChargeDto) {
    // Get existing charge from database (in paise)
    const [existingDb] = await this.db
      .select()
      .from(paymentMethodCharges)
      .where(eq(paymentMethodCharges.id, id))
      .limit(1);

    if (!existingDb) {
      throw new NotFoundException(`Payment charge with ID ${id} not found`);
    }

    // Convert existing to rupees for validation
    const existing = {
      ...existingDb,
      flatAmount: existingDb.flatAmount / 100,
      mixCap: existingDb.mixCap ? existingDb.mixCap / 100 : null,
      mixMin: existingDb.mixMin ? existingDb.mixMin / 100 : null,
      codMaxAmount: existingDb.codMaxAmount
        ? existingDb.codMaxAmount / 100
        : null,
    };

    // If charge type is being updated, validate the new type
    if (dto.chargeType && dto.chargeType !== existing.chargeType) {
      this.validateChargeType({
        chargeType: dto.chargeType,
        flatAmount: dto.flatAmount ?? existing.flatAmount,
        percentage: dto.percentage ?? existing.percentage,
        mixCap: dto.mixCap ?? existing.mixCap ?? undefined,
        mixMin: dto.mixMin ?? existing.mixMin ?? undefined,
      } as CreatePaymentChargeDto);
    }

    // Convert rupees to paise for storage
    const updateData: Partial<typeof paymentMethodCharges.$inferInsert> = {
      ...(dto.chargeType && {
        chargeType: dto.chargeType as unknown as ChargeType,
      }),
      ...(dto.flatAmount !== undefined && {
        flatAmount: Math.round(dto.flatAmount * 100),
      }),
      ...(dto.percentage !== undefined && { percentage: dto.percentage }),
      ...(dto.mixCap !== undefined && {
        mixCap: dto.mixCap !== null ? Math.round(dto.mixCap * 100) : null,
      }),
      ...(dto.mixMin !== undefined && {
        mixMin: dto.mixMin !== null ? Math.round(dto.mixMin * 100) : null,
      }),
      ...(dto.isTaxable !== undefined && { isTaxable: dto.isTaxable }),
      ...(dto.currency && { currency: dto.currency }),
      ...(dto.codMaxAmount !== undefined && {
        codMaxAmount:
          dto.codMaxAmount !== null ? Math.round(dto.codMaxAmount * 100) : null,
      }),
      ...(dto.codDisallowHighValue !== undefined && {
        codDisallowHighValue: dto.codDisallowHighValue,
      }),
      ...(dto.codDisallowDigital !== undefined && {
        codDisallowDigital: dto.codDisallowDigital,
      }),
      ...(dto.codDisallowPreorder !== undefined && {
        codDisallowPreorder: dto.codDisallowPreorder,
      }),
      ...(dto.active !== undefined && { active: dto.active }),
      updatedAt: new Date(),
    };

    const [updated] = await this.db
      .update(paymentMethodCharges)
      .set(updateData)
      .where(eq(paymentMethodCharges.id, id))
      .returning();

    this.logger.info(
      { chargeId: id, method: updated.method },
      "Payment charge updated",
    );

    // Return charge with amounts converted back to rupees
    return {
      ...updated,
      flatAmount: updated.flatAmount / 100,
      mixCap: updated.mixCap ? updated.mixCap / 100 : null,
      mixMin: updated.mixMin ? updated.mixMin / 100 : null,
      codMaxAmount: updated.codMaxAmount ? updated.codMaxAmount / 100 : null,
    };
  }

  async remove(id: string) {
    await this.findOne(id); // Throws if not found

    await this.db
      .delete(paymentMethodCharges)
      .where(eq(paymentMethodCharges.id, id));

    this.logger.info({ chargeId: id }, "Payment charge deleted");

    return { success: true };
  }

  async previewFee(chargeId: string, cartTotal: number) {
    const charge = await this.findOne(chargeId);

    // Convert cart total from rupees to paise for calculation
    const cartTotalInPaise = Math.round(cartTotal * 100);

    const { fee, breakdown } = await this.paymentChargeService.calculateFee(
      charge.method,
      cartTotalInPaise,
      charge.currency,
    );

    // Convert fee from paise to rupees for response
    return {
      charge,
      cartTotal,
      fee: fee / 100,
      breakdown: {
        ...breakdown,
        flatAmount: breakdown.flatAmount
          ? breakdown.flatAmount / 100
          : undefined,
        calculatedFee: breakdown.calculatedFee / 100,
        mixMin: breakdown.mixMin ? breakdown.mixMin / 100 : undefined,
        mixCap: breakdown.mixCap ? breakdown.mixCap / 100 : undefined,
      },
      feeInRupees: fee / 100,
    };
  }

  private validateChargeType(dto: {
    chargeType: string;
    flatAmount: number;
    percentage: number;
    mixCap?: number;
    mixMin?: number;
  }) {
    if (dto.chargeType === "FLAT") {
      if (dto.flatAmount <= 0) {
        throw new BadRequestException(
          "Flat amount must be greater than 0 for FLAT charge type",
        );
      }
    } else if (dto.chargeType === "PERCENTAGE") {
      if (dto.percentage <= 0) {
        throw new BadRequestException(
          "Percentage must be greater than 0 for PERCENTAGE charge type",
        );
      }
    } else if (dto.chargeType === "MIXED") {
      if (dto.percentage <= 0) {
        throw new BadRequestException(
          "Percentage must be greater than 0 for MIXED charge type",
        );
      }
      if (dto.mixCap !== undefined && dto.mixMin !== undefined) {
        if (dto.mixCap < dto.mixMin) {
          throw new BadRequestException(
            "Mix cap must be greater than or equal to mix min",
          );
        }
      }
    }
  }
}
