import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";

export interface ValidationError {
  field: string;
  value: string;
  errorCode: string;
  errorMessage: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: {
    sku: string;
    quantity: number;
    adjustmentType?: "increase" | "decrease" | "set";
    reason?: string;
    note?: string;
  };
}

@Injectable()
export class InventoryValidator {
  private readonly VALID_ADJUSTMENT_TYPES = ["increase", "decrease", "set"];
  private readonly VALID_REASONS = [
    "received",
    "correction",
    "damaged",
    "lost",
    "returned",
    "giveaway",
    "manual",
  ];

  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
  ) {}

  /**
   * Validate inventory import row
   */
  validate(row: Record<string, string>): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    const sku = this.validateRequired(row, "sku", errors);
    const quantity = this.validateQuantity(row, "quantity", errors);

    // Optional fields
    const adjustmentType = this.validateAdjustmentType(
      row,
      "adjustmentType",
      errors,
    );
    const reason = this.validateReason(row, "reason", errors);
    const note = row.note?.trim() || undefined;

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
      };
    }

    if (!sku || quantity === undefined) {
      return {
        isValid: false,
        errors: [
          {
            field: sku ? "quantity" : "sku",
            value: "",
            errorCode: "REQUIRED_FIELD_MISSING",
            errorMessage: "Required field is missing",
          },
        ],
      };
    }

    return {
      isValid: true,
      errors: [],
      data: {
        sku,
        quantity,
        adjustmentType,
        reason,
        note,
      },
    };
  }

  private validateRequired(
    row: Record<string, string>,
    field: string,
    errors: ValidationError[],
  ): string | undefined {
    const value = row[field]?.trim();
    if (!value) {
      errors.push({
        field,
        value: "",
        errorCode: "REQUIRED_FIELD_MISSING",
        errorMessage: `${this.formatFieldName(field)} is required`,
      });
      return undefined;
    }
    return value;
  }

  private validateQuantity(
    row: Record<string, string>,
    field: string,
    errors: ValidationError[],
  ): number | undefined {
    const value = row[field]?.trim();
    if (!value) {
      errors.push({
        field,
        value: "",
        errorCode: "REQUIRED_FIELD_MISSING",
        errorMessage: `${this.formatFieldName(field)} is required`,
      });
      return undefined;
    }

    const numValue = parseInt(value, 10);
    if (Number.isNaN(numValue)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_NUMBER",
        errorMessage: `${this.formatFieldName(field)} must be a valid integer`,
      });
      return undefined;
    }

    if (numValue < 0) {
      errors.push({
        field,
        value,
        errorCode: "NEGATIVE_QUANTITY",
        errorMessage: `${this.formatFieldName(field)} must be greater than or equal to 0`,
      });
      return undefined;
    }

    return numValue;
  }

  private validateAdjustmentType(
    row: Record<string, string>,
    field: string,
    errors: ValidationError[],
  ): "increase" | "decrease" | "set" | undefined {
    const value = row[field]?.trim()?.toLowerCase();
    if (!value) {
      return undefined;
    }

    if (!this.VALID_ADJUSTMENT_TYPES.includes(value)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_ADJUSTMENT_TYPE",
        errorMessage: `Adjustment type must be one of: ${this.VALID_ADJUSTMENT_TYPES.join(", ")}`,
      });
      return undefined;
    }

    return value as "increase" | "decrease" | "set";
  }

  private validateReason(
    row: Record<string, string>,
    field: string,
    errors: ValidationError[],
  ): string | undefined {
    const value = row[field]?.trim()?.toLowerCase();
    if (!value) {
      return undefined;
    }

    if (!this.VALID_REASONS.includes(value)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_REASON",
        errorMessage: `Reason must be one of: ${this.VALID_REASONS.join(", ")}`,
      });
      return undefined;
    }

    return value;
  }

  private formatFieldName(field: string): string {
    return field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}
