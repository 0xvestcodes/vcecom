import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import * as XLSX from "xlsx";
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
  sheetName?: string;
}

@Injectable()
export class ExcelParser {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Parse Excel file buffer
   * @param buffer - Excel file buffer
   * @param options - Parser options
   */
  async parse(
    buffer: Buffer,
    options?: {
      sheetName?: string;
      sheetIndex?: number;
      skipHeader?: boolean;
      headers?: string[];
    },
  ): Promise<ParseResult> {
    try {
      // Read workbook
      const workbook = XLSX.read(buffer, {
        type: "buffer",
        cellDates: true,
        cellNF: false,
        cellText: false,
      });

      if (workbook.SheetNames.length === 0) {
        throw new Error("Excel file contains no sheets");
      }

      // Determine which sheet to use
      let sheetName: string;
      if (options?.sheetName) {
        if (!workbook.SheetNames.includes(options.sheetName)) {
          throw new Error(
            `Sheet "${options.sheetName}" not found. Available sheets: ${workbook.SheetNames.join(", ")}`,
          );
        }
        sheetName = options.sheetName;
      } else {
        const sheetIndex = options?.sheetIndex ?? 0;
        if (sheetIndex >= workbook.SheetNames.length) {
          throw new Error(
            `Sheet index ${sheetIndex} is out of range. File has ${workbook.SheetNames.length} sheet(s)`,
          );
        }
        sheetName = workbook.SheetNames[sheetIndex];
      }

      // Get worksheet
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Failed to read sheet "${sheetName}"`);
      }

      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        {
          raw: false, // Convert all values to strings for consistency
          defval: "", // Default value for empty cells
          blankrows: false, // Skip blank rows
        },
      );

      if (rawData.length === 0) {
        throw new Error(
          `Sheet "${sheetName}" is empty or contains no data rows`,
        );
      }

      // Extract headers
      const headers =
        options?.headers || (Object.keys(rawData[0] || {}) as string[]);

      // Convert to ParsedRow format
      const rows: ParsedRow[] = rawData.map((record, index) => {
        const rowData: Record<string, string> = {};
        for (const [key, value] of Object.entries(record)) {
          // Convert all values to strings, handling null/undefined
          rowData[key] = value != null ? String(value).trim() : "";
        }
        return {
          rowNumber: options?.skipHeader ? index + 2 : index + 1,
          data: rowData,
        };
      });

      return {
        headers,
        rows,
        totalRows: rows.length,
        sheetName,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "parse", error, {
          bufferSize: buffer.length,
          options,
        }),
        "Failed to parse Excel file",
      );
      throw new Error(
        `Excel parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get list of sheet names from Excel file
   */
  async getSheetNames(buffer: Buffer): Promise<string[]> {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      return workbook.SheetNames;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getSheetNames", error),
        "Failed to read Excel sheet names",
      );
      throw new Error(
        `Failed to read Excel sheet names: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
