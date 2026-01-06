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
    email: string;
    name: string;
    phone: string;
    gstin?: string;
    customerGroupId?: string;
  };
}

@Injectable()
export class CustomerValidator {
  private readonly PHONE_REGEX = /^[6-9]\d{9}$/;
  private readonly GSTIN_REGEX =
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
  ) {}

  /**
   * Validate customer import row
   */
  validate(row: Record<string, string>): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    const email = this.validateEmail(row, "email", errors);
    const name = this.validateRequired(row, "name", errors);
    const phone = this.validatePhone(row, "phone", errors);

    // Optional fields
    const gstin = this.validateGstin(row, "gstin", errors);
    const customerGroupId = this.validateUuid(row, "customerGroupId", errors);

    // Validate name length
    if (name && name.length > 255) {
      errors.push({
        field: "name",
        value: `${name.substring(0, 50)}...`,
        errorCode: "NAME_TOO_LONG",
        errorMessage: "Name must not exceed 255 characters",
      });
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
      };
    }

    if (!email || !name || !phone) {
      return {
        isValid: false,
        errors: [
          {
            field: email ? (name ? "phone" : "name") : "email",
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
        email,
        name,
        phone,
        gstin,
        customerGroupId,
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

  private validateEmail(
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_EMAIL_FORMAT",
        errorMessage: "Email must be a valid email address",
      });
      return undefined;
    }

    return value;
  }

  private validatePhone(
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

    // Remove any non-digit characters for validation
    const digitsOnly = value.replace(/\D/g, "");

    if (!this.PHONE_REGEX.test(digitsOnly)) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_PHONE_FORMAT",
        errorMessage: "Phone must be a valid 10-digit Indian mobile number",
      });
      return undefined;
    }

    return digitsOnly;
  }

  private validateGstin(
    row: Record<string, string>,
    field: string,
    errors: ValidationError[],
  ): string | undefined {
    const value = row[field]?.trim();
    if (!value) {
      return undefined;
    }

    if (value.length !== 15) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_GSTIN_LENGTH",
        errorMessage: "GSTIN must be exactly 15 characters",
      });
      return undefined;
    }

    if (!this.GSTIN_REGEX.test(value.toUpperCase())) {
      errors.push({
        field,
        value,
        errorCode: "INVALID_GSTIN_FORMAT",
        errorMessage:
          "GSTIN must be a valid 15-character GST Identification Number",
      });
      return undefined;
    }

    return value.toUpperCase();
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

  private formatFieldName(field: string): string {
    return field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}
