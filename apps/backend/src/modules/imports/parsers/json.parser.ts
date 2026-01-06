import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
}

@Injectable()
export class JsonParser {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Parse JSON file buffer
   * @param buffer - JSON file buffer
   * @param options - Parser options
   */
  async parse(
    buffer: Buffer,
    options?: {
      flatten?: boolean;
      headers?: string[];
    },
  ): Promise<ParseResult> {
    try {
      const text = buffer.toString("utf-8");
      const parsed = JSON.parse(text);

      // Handle array of objects
      if (!Array.isArray(parsed)) {
        throw new Error(
          "JSON file must contain an array of objects. Root level must be an array.",
        );
      }

      if (parsed.length === 0) {
        throw new Error("JSON array is empty");
      }

      // Flatten nested objects if needed
      const flattenedData = options?.flatten
        ? parsed.map((item) => this.flattenObject(item))
        : parsed;

      // Extract headers from first object
      const headers =
        options?.headers || (Object.keys(flattenedData[0] || {}) as string[]);

      // Convert to ParsedRow format
      const rows: ParsedRow[] = flattenedData.map((record, index) => {
        const rowData: Record<string, string> = {};
        for (const [key, value] of Object.entries(record)) {
          // Convert all values to strings
          rowData[key] = value != null ? String(value).trim() : "";
        }
        return {
          rowNumber: index + 1,
          data: rowData,
        };
      });

      return {
        headers,
        rows,
        totalRows: rows.length,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "parse", error, {
          bufferSize: buffer.length,
          options,
        }),
        "Failed to parse JSON file",
      );

      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON format: ${error.message}`);
      }

      throw new Error(
        `JSON parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Flatten nested objects to dot notation
   * Example: { user: { name: "John" } } -> { "user.name": "John" }
   */
  private flattenObject(
    obj: Record<string, unknown>,
    prefix = "",
  ): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (
        value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        // Recursively flatten nested objects
        Object.assign(
          flattened,
          this.flattenObject(value as Record<string, unknown>, newKey),
        );
      } else {
        // Convert arrays and dates to strings
        if (Array.isArray(value)) {
          flattened[newKey] = JSON.stringify(value);
        } else if (value instanceof Date) {
          flattened[newKey] = value.toISOString();
        } else {
          flattened[newKey] = value;
        }
      }
    }

    return flattened;
  }
}
