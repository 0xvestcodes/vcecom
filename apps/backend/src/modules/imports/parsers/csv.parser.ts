import { Injectable } from "@nestjs/common";
import { parse } from "csv-parse/sync";
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
export class CsvParser {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Parse CSV file buffer
   * @param buffer - CSV file buffer
   * @param options - Parser options
   */
  async parse(
    buffer: Buffer,
    options?: {
      delimiter?: string;
      skipEmptyLines?: boolean;
      skipHeader?: boolean;
      headers?: string[];
    },
  ): Promise<ParseResult> {
    try {
      const text = buffer.toString("utf-8");

      // Auto-detect delimiter if not provided
      const delimiter = options?.delimiter || this.detectDelimiter(text);

      // Parse CSV
      const records = parse(text, {
        delimiter,
        skip_empty_lines: options?.skipEmptyLines ?? true,
        columns: options?.headers || true, // Auto-detect headers if not provided
        trim: true,
        relax_quotes: true,
        relax_column_count: true,
        bom: true, // Handle BOM
      }) as Array<Record<string, string>>;

      if (records.length === 0) {
        throw new Error("CSV file is empty or contains no data rows");
      }

      // Extract headers
      const headers = options?.headers || Object.keys(records[0] || {});

      // Convert to ParsedRow format
      const rows: ParsedRow[] = records.map((record, index) => ({
        rowNumber: options?.skipHeader ? index + 2 : index + 1, // +1 for header row if skipped
        data: record,
      }));

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
        "Failed to parse CSV file",
      );
      throw new Error(
        `CSV parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Detect CSV delimiter (comma, semicolon, or tab)
   */
  private detectDelimiter(text: string): string {
    const firstLine = text.split("\n")[0] || "";
    const delimiters = [",", ";", "\t"];
    let maxCount = 0;
    let detectedDelimiter = ",";

    for (const delimiter of delimiters) {
      const count = (firstLine.match(new RegExp(`\\${delimiter}`, "g")) || [])
        .length;
      if (count > maxCount) {
        maxCount = count;
        detectedDelimiter = delimiter;
      }
    }

    return detectedDelimiter;
  }
}
