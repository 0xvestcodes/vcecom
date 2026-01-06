import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import * as XLSX from "xlsx";
import { ContextService } from "../../../common/logging/context.service";
import { CsvGenerator } from "../../exports/generators/csv.generator";
import { ImportType } from "../dto/imports.dto";

export interface TemplateColumn {
  name: string;
  label: string;
  required: boolean;
  type: string;
  description?: string;
  example?: string;
}

@Injectable()
export class TemplateGeneratorService {
  constructor(
    private readonly csvGenerator: CsvGenerator,
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
  ) {}

  /**
   * Generate CSV template for import type
   */
  async generateCsvTemplate(type: ImportType): Promise<Buffer> {
    const { columns, sampleData } = this.getTemplateData(type);
    const headers = columns.map((col) => col.name);
    return this.csvGenerator.generate(sampleData, headers);
  }

  /**
   * Generate Excel template for import type
   */
  async generateExcelTemplate(type: ImportType): Promise<Buffer> {
    const { columns, sampleData } = this.getTemplateData(type);
    const headers = columns.map((col) => col.name);

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Create worksheet with headers and sample data
    const worksheetData = [
      headers,
      ...sampleData.map((row) => headers.map((h) => row[h] || "")),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Add column descriptions as comments or second sheet
    const descriptionSheet = XLSX.utils.aoa_to_sheet([
      ["Column", "Description", "Required", "Type", "Example"],
      ...columns.map((col) => [
        col.name,
        col.description || "",
        col.required ? "Yes" : "No",
        col.type,
        col.example || "",
      ]),
    ]);

    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.utils.book_append_sheet(
      workbook,
      descriptionSheet,
      "Column Descriptions",
    );

    // Convert to buffer
    return Buffer.from(
      XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    );
  }

  /**
   * Get template data for import type
   */
  private getTemplateData(type: ImportType): {
    columns: TemplateColumn[];
    sampleData: Array<Record<string, string>>;
  } {
    switch (type) {
      case "products":
        return {
          columns: [
            {
              name: "title",
              label: "Product Title",
              required: true,
              type: "string",
              description: "Product name/title",
              example: "Wireless Bluetooth Headphones",
            },
            {
              name: "description",
              label: "Description",
              required: false,
              type: "string",
              description: "Product description",
              example: "High-quality wireless headphones",
            },
            {
              name: "price",
              label: "Price",
              required: true,
              type: "number",
              description: "Product price in INR",
              example: "2999.99",
            },
            {
              name: "gstRate",
              label: "GST Rate",
              required: false,
              type: "number",
              description: "GST rate (0, 5, 12, 18, or 28)",
              example: "18",
            },
            {
              name: "pricingType",
              label: "Pricing Type",
              required: false,
              type: "enum",
              description: "inclusive or exclusive",
              example: "exclusive",
            },
            {
              name: "hsnCode",
              label: "HSN Code",
              required: false,
              type: "string",
              description: "Harmonized System of Nomenclature code",
              example: "8518.12.00",
            },
            {
              name: "status",
              label: "Status",
              required: false,
              type: "enum",
              description: "draft, active, or archived",
              example: "draft",
            },
            {
              name: "categoryId",
              label: "Category ID",
              required: false,
              type: "uuid",
              description: "UUID of the category",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
          ],
          sampleData: [
            {
              title: "Wireless Bluetooth Headphones",
              description:
                "High-quality wireless headphones with noise cancellation",
              price: "2999.99",
              gstRate: "18",
              pricingType: "exclusive",
              hsnCode: "8518.12.00",
              status: "draft",
              categoryId: "",
            },
          ],
        };

      case "categories":
        return {
          columns: [
            {
              name: "name",
              label: "Category Name",
              required: true,
              type: "string",
              description: "Category name",
              example: "Electronics",
            },
            {
              name: "slug",
              label: "Slug",
              required: false,
              type: "string",
              description: "URL-friendly slug (auto-generated if not provided)",
              example: "electronics",
            },
            {
              name: "parentId",
              label: "Parent Category ID",
              required: false,
              type: "uuid",
              description:
                "UUID of parent category for hierarchical categories",
              example: "",
            },
            {
              name: "description",
              label: "Description",
              required: false,
              type: "string",
              description: "Category description",
              example: "Electronic devices and accessories",
            },
            {
              name: "imageUrl",
              label: "Image URL",
              required: false,
              type: "url",
              description: "Category image URL",
              example: "https://example.com/images/electronics.jpg",
            },
          ],
          sampleData: [
            {
              name: "Electronics",
              slug: "electronics",
              parentId: "",
              description: "Electronic devices and accessories",
              imageUrl: "",
            },
          ],
        };

      case "inventory":
        return {
          columns: [
            {
              name: "sku",
              label: "SKU",
              required: true,
              type: "string",
              description: "Product variant SKU",
              example: "PROD-001-BLACK-L",
            },
            {
              name: "quantity",
              label: "Quantity",
              required: true,
              type: "number",
              description: "Inventory quantity",
              example: "100",
            },
            {
              name: "adjustmentType",
              label: "Adjustment Type",
              required: false,
              type: "enum",
              description: "increase, decrease, or set",
              example: "set",
            },
            {
              name: "reason",
              label: "Reason",
              required: false,
              type: "enum",
              description:
                "received, correction, damaged, lost, returned, giveaway, manual",
              example: "received",
            },
            {
              name: "note",
              label: "Note",
              required: false,
              type: "string",
              description: "Optional note for the adjustment",
              example: "Stock received from supplier",
            },
          ],
          sampleData: [
            {
              sku: "PROD-001-BLACK-L",
              quantity: "100",
              adjustmentType: "set",
              reason: "received",
              note: "Stock received from supplier",
            },
          ],
        };

      case "customers":
        return {
          columns: [
            {
              name: "email",
              label: "Email",
              required: true,
              type: "email",
              description: "Customer email address",
              example: "customer@example.com",
            },
            {
              name: "name",
              label: "Name",
              required: true,
              type: "string",
              description: "Customer name",
              example: "John Doe",
            },
            {
              name: "phone",
              label: "Phone",
              required: true,
              type: "string",
              description: "10-digit Indian mobile number",
              example: "9876543210",
            },
            {
              name: "gstin",
              label: "GSTIN",
              required: false,
              type: "string",
              description: "15-character GST Identification Number",
              example: "27ABCDE1234F1Z5",
            },
            {
              name: "customerGroupId",
              label: "Customer Group ID",
              required: false,
              type: "uuid",
              description: "UUID of the customer group",
              example: "",
            },
          ],
          sampleData: [
            {
              email: "customer@example.com",
              name: "John Doe",
              phone: "9876543210",
              gstin: "",
              customerGroupId: "",
            },
          ],
        };

      default:
        throw new Error(`Unsupported import type: ${type}`);
    }
  }
}
