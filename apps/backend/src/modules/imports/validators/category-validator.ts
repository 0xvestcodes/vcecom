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
    name: string;
    slug?: string;
    parentId?: string;
    description?: string;
    imageUrl?: string;
  };
}

@Injectable()
export class CategoryValidator {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
  ) {}

  /**
   * Validate category import row
   */
  validate(row: Record<string, string>): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    const name = this.validateRequired(row, "name", errors);

    // Optional fields
    const slug = row.slug?.trim() || undefined;
    const parentId = this.validateUuid(row, "parentId", errors);
    const description = row.description?.trim() || undefined;
    const imageUrl = row.imageUrl?.trim() || undefined;

    // Validate slug format if provided
    if (slug) {
      if (!this.isValidSlug(slug)) {
        errors.push({
          field: "slug",
          value: slug,
          errorCode: "INVALID_SLUG_FORMAT",
          errorMessage:
            "Slug must contain only lowercase letters, numbers, and hyphens",
        });
      }
      if (slug.length > 255) {
        errors.push({
          field: "slug",
          value: slug,
          errorCode: "SLUG_TOO_LONG",
          errorMessage: "Slug must not exceed 255 characters",
        });
      }
    }

    // Validate name length
    if (name && name.length > 255) {
      errors.push({
        field: "name",
        value: `${name.substring(0, 50)}...`,
        errorCode: "NAME_TOO_LONG",
        errorMessage: "Name must not exceed 255 characters",
      });
    }

    // Validate description length if provided
    if (description && description.length > 1000) {
      errors.push({
        field: "description",
        value: `${description.substring(0, 50)}...`,
        errorCode: "DESCRIPTION_TOO_LONG",
        errorMessage: "Description must not exceed 1000 characters",
      });
    }

    // Validate image URL length if provided
    if (imageUrl && imageUrl.length > 500) {
      errors.push({
        field: "imageUrl",
        value: `${imageUrl.substring(0, 50)}...`,
        errorCode: "IMAGE_URL_TOO_LONG",
        errorMessage: "Image URL must not exceed 500 characters",
      });
    }

    // Validate image URL format if provided
    if (imageUrl && !this.isValidUrl(imageUrl)) {
      errors.push({
        field: "imageUrl",
        value: imageUrl,
        errorCode: "INVALID_URL_FORMAT",
        errorMessage: "Image URL must be a valid URL",
      });
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
      };
    }

    if (!name) {
      return {
        isValid: false,
        errors: [
          {
            field: "name",
            value: "",
            errorCode: "REQUIRED_FIELD_MISSING",
            errorMessage: "Name is required",
          },
        ],
      };
    }

    return {
      isValid: true,
      errors: [],
      data: {
        name,
        slug,
        parentId,
        description,
        imageUrl,
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

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private formatFieldName(field: string): string {
    return field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}
