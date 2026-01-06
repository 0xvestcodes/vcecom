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
    title: string;
    description?: string;
    slug?: string;
    price: number;
    gstRate?: number;
    pricingType?: "inclusive" | "exclusive";
    hsnCode?: string;
    status?: "draft" | "active" | "archived";
    categoryId?: string;
  };
}

@Injectable()
export class ProductValidator {
  private readonly VALID_GST_RATES = [0, 5, 12, 18, 28];
  private readonly VALID_STATUSES = ["draft", "active", "archived"];
  private readonly VALID_PRICING_TYPES = ["inclusive", "exclusive"];

  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
  ) {}

  /**
   * Validate product import row
   */
  validate(row: Record<string, string>): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    const title = this.validateRequired(row, "title", errors);
    const price = this.validatePrice(row, "price", errors);

    // Optional fields
    const description = row.description?.trim() || undefined;
    const slug = row.slug?.trim() || undefined;
    const gstRate = this.validateGstRate(row, "gstRate", errors);
    const pricingType = this.validatePricingType(row, "pricingType", errors);
    const hsnCode = row.hsnCode?.trim() || undefined;
    const status = this.validateStatus(row, "status", errors);
    const categoryId = this.validateUuid(row, "categoryId", errors);

    // Validate slug format if provided
    if (slug && !this.isValidSlug(slug)) {
      errors.push({
        field: "slug",
        value: slug,
        errorCode: "INVALID_SLUG_FORMAT",
        errorMessage:
          "Slug must contain only lowercase letters, numbers, and hyphens",
      });
    }

    // Validate HSN code length if provided
    if (hsnCode && hsnCode.length > 50) {
      errors.push({
        field: "hsnCode",
        value: hsnCode,
        errorCode: "HSN_CODE_TOO_LONG",
        errorMessage: "HSN code must not exceed 50 characters",
      });
    }

    // Validate description length if provided
    if (description && description.length > 5000) {
      errors.push({
        field: "description",
        value: `${description.substring(0, 50)}...`,
        errorCode: "DESCRIPTION_TOO_LONG",
        errorMessage: "Description must not exceed 5000 characters",
      });
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
      };
    }

    if (!title || price === undefined) {
      return {
        isValid: false,
        errors: [
          {
            field: title ? "price" : "title",
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
        title,
        description,
        slug,
        price,
        gstRate,
        pricingType,
        hsnCode,
        status,
        categoryId,
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

  private validatePrice(
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

    const numValue = parseFloat(value);
    if (Number.isNaN(numValue)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_NUMBER",
        errorMessage: `${this.formatFieldName(field)} must be a valid number`,
      });
      return undefined;
    }

    if (numValue < 0) {
      errors.push({
        field,
        value,
        errorCode: "NEGATIVE_PRICE",
        errorMessage: `${this.formatFieldName(field)} must be greater than or equal to 0`,
      });
      return undefined;
    }

    return numValue;
  }

  private validateGstRate(
    row: Record<string, string>,
    field: string,
    errors: ValidationError[],
  ): number | undefined {
    const value = row[field]?.trim();
    if (!value) {
      return undefined;
    }

    const numValue = parseFloat(value);
    if (Number.isNaN(numValue)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_GST_RATE",
        errorMessage: `GST rate must be a valid number`,
      });
      return undefined;
    }

    if (!this.VALID_GST_RATES.includes(numValue)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_GST_RATE",
        errorMessage: `GST rate must be one of: ${this.VALID_GST_RATES.join(", ")}%`,
      });
      return undefined;
    }

    return numValue;
  }

  private validatePricingType(
    row: Record<string, string>,
    field: string,
    errors: ValidationError[],
  ): "inclusive" | "exclusive" | undefined {
    const value = row[field]?.trim()?.toLowerCase();
    if (!value) {
      return undefined;
    }

    if (!this.VALID_PRICING_TYPES.includes(value)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_PRICING_TYPE",
        errorMessage: `Pricing type must be one of: ${this.VALID_PRICING_TYPES.join(", ")}`,
      });
      return undefined;
    }

    return value as "inclusive" | "exclusive";
  }

  private validateStatus(
    row: Record<string, string>,
    field: string,
    errors: ValidationError[],
  ): "draft" | "active" | "archived" | undefined {
    const value = row[field]?.trim()?.toLowerCase();
    if (!value) {
      return undefined;
    }

    if (!this.VALID_STATUSES.includes(value)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_STATUS",
        errorMessage: `Status must be one of: ${this.VALID_STATUSES.join(", ")}`,
      });
      return undefined;
    }

    return value as "draft" | "active" | "archived";
  }

  private validateUuid(
    row: Record<string, string>,
    field: string,
    errors: ValidationError[],
  ): string | undefined {
    const value = row[field]?.trim();
    if (!value) {
      return undefined;
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_UUID",
        errorMessage: `${this.formatFieldName(field)} must be a valid UUID`,
      });
      return undefined;
    }

    return value;
  }

  private isValidSlug(slug: string): boolean {
    return /^[a-z0-9-]+$/.test(slug);
  }

  private formatFieldName(field: string): string {
    return field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}
