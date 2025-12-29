import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { sanitizeUserInput } from "../utils/sanitize";

/**
 * Pipe to sanitize string inputs to prevent XSS attacks
 * Strips HTML tags from string values
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (typeof value === "string") {
      return sanitizeUserInput(value);
    }

    if (typeof value === "object" && value !== null) {
      return this.sanitizeObject(value);
    }

    return value;
  }

  private sanitizeObject(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (typeof obj === "object" && obj !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === "string") {
          sanitized[key] = sanitizeUserInput(val);
        } else if (typeof val === "object" && val !== null) {
          sanitized[key] = this.sanitizeObject(val);
        } else {
          sanitized[key] = val;
        }
      }
      return sanitized;
    }

    return obj;
  }
}
