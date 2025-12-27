import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  customers,
  eq,
  gte,
  lte,
  orders,
  products,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { InventoryStore } from "../redis-store/stores/inventory-store";
import { StorageService } from "../storage/storage.service";
import {
  ExportCustomersDto,
  ExportFormat,
  ExportInventoryDto,
  ExportOrdersDto,
  ExportProductsDto,
} from "./dto/exports.dto";
import { CsvGenerator } from "./generators/csv.generator";
import { PdfGenerator } from "./generators/pdf.generator";
import { ZipGenerator } from "./generators/zip.generator";

@Injectable()
export class ExportsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly storageService: StorageService,
    private readonly csvGenerator: CsvGenerator,
    private readonly pdfGenerator: PdfGenerator,
    private readonly zipGenerator: ZipGenerator,
    private readonly inventoryStore: InventoryStore,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Export orders
   */
  async exportOrders(dto: ExportOrdersDto): Promise<{ url: string }> {
    try {
      // Fetch orders data (simplified - would need actual query with filters)
      const data = await this.fetchOrdersData(dto);

      let buffer: Buffer;
      let contentType: string;
      let extension: string;

      switch (dto.format) {
        case ExportFormat.CSV:
          buffer = await this.csvGenerator.generate(
            data,
            this.getOrderHeaders(),
          );
          contentType = "text/csv";
          extension = "csv";
          break;
        case ExportFormat.PDF:
          buffer = await this.pdfGenerator.generateOrders(data);
          contentType = "application/pdf";
          extension = "pdf";
          break;
        case ExportFormat.ZIP:
          buffer = await this.zipGenerator.generateOrders(data);
          contentType = "application/zip";
          extension = "zip";
          break;
        default:
          throw new Error(`Unsupported format: ${dto.format}`);
      }

      // Upload to storage
      const key = `exports/orders-${Date.now()}.${extension}`;
      const url = await this.storageService.upload(key, buffer, contentType);

      return { url };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "exportOrders", error, { dto }),
        "Failed to export orders",
      );
      throw error;
    }
  }

  /**
   * Export products
   */
  async exportProducts(dto: ExportProductsDto): Promise<{ url: string }> {
    try {
      const data = await this.fetchProductsData(dto);

      let buffer: Buffer;
      let contentType: string;
      let extension: string;

      switch (dto.format) {
        case ExportFormat.CSV:
          buffer = await this.csvGenerator.generate(
            data,
            this.getProductHeaders(),
          );
          contentType = "text/csv";
          extension = "csv";
          break;
        case ExportFormat.PDF:
          buffer = await this.pdfGenerator.generateProducts(data);
          contentType = "application/pdf";
          extension = "pdf";
          break;
        case ExportFormat.ZIP:
          buffer = await this.zipGenerator.generateProducts(data);
          contentType = "application/zip";
          extension = "zip";
          break;
        default:
          throw new Error(`Unsupported format: ${dto.format}`);
      }

      const key = `exports/products-${Date.now()}.${extension}`;
      const url = await this.storageService.upload(key, buffer, contentType);

      return { url };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "exportProducts", error, {
          dto,
        }),
        "Failed to export products",
      );
      throw error;
    }
  }

  /**
   * Export customers
   */
  async exportCustomers(dto: ExportCustomersDto): Promise<{ url: string }> {
    try {
      const data = await this.fetchCustomersData();

      let buffer: Buffer;
      let contentType: string;
      let extension: string;

      switch (dto.format) {
        case ExportFormat.CSV:
          buffer = await this.csvGenerator.generate(
            data,
            this.getCustomerHeaders(),
          );
          contentType = "text/csv";
          extension = "csv";
          break;
        case ExportFormat.PDF:
          buffer = await this.pdfGenerator.generateCustomers(data);
          contentType = "application/pdf";
          extension = "pdf";
          break;
        case ExportFormat.ZIP:
          buffer = await this.zipGenerator.generateCustomers(data);
          contentType = "application/zip";
          extension = "zip";
          break;
        default:
          throw new Error(`Unsupported format: ${dto.format}`);
      }

      const key = `exports/customers-${Date.now()}.${extension}`;
      const url = await this.storageService.upload(key, buffer, contentType);

      return { url };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "exportCustomers", error, {
          dto,
        }),
        "Failed to export customers",
      );
      throw error;
    }
  }

  /**
   * Export inventory
   */
  async exportInventory(dto: ExportInventoryDto): Promise<{ url: string }> {
    try {
      const data = await this.fetchInventoryData();

      let buffer: Buffer;
      let contentType: string;
      let extension: string;

      switch (dto.format) {
        case ExportFormat.CSV:
          buffer = await this.csvGenerator.generate(
            data,
            this.getInventoryHeaders(),
          );
          contentType = "text/csv";
          extension = "csv";
          break;
        case ExportFormat.PDF:
          buffer = await this.pdfGenerator.generateInventory(data);
          contentType = "application/pdf";
          extension = "pdf";
          break;
        case ExportFormat.ZIP:
          buffer = await this.zipGenerator.generateInventory(data);
          contentType = "application/zip";
          extension = "zip";
          break;
        default:
          throw new Error(`Unsupported format: ${dto.format}`);
      }

      const key = `exports/inventory-${Date.now()}.${extension}`;
      const url = await this.storageService.upload(key, buffer, contentType);

      return { url };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "exportInventory", error, {
          dto,
        }),
        "Failed to export inventory",
      );
      throw error;
    }
  }

  // Data fetching methods
  private async fetchOrdersData(
    dto: ExportOrdersDto,
  ): Promise<Record<string, unknown>[]> {
    const conditions: ReturnType<typeof gte | typeof lte>[] = [];

    if (dto.startDate) {
      conditions.push(gte(orders.createdAt, new Date(dto.startDate)));
    }
    if (dto.endDate) {
      conditions.push(lte(orders.createdAt, new Date(dto.endDate)));
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    let ordersList: Array<{
      id: string;
      orderNumber: string;
      status: string;
      total: number;
      subtotal: number;
      gstAmount: number;
      discountAmount: number;
      shippingCost: number;
      createdAt: Date;
      customerId: string;
    }>;
    try {
      ordersList = await this.db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          total: orders.total,
          subtotal: orders.subtotal,
          gstAmount: orders.gstAmount,
          discountAmount: orders.discountAmount,
          shippingCost: orders.shippingCost,
          createdAt: orders.createdAt,
          customerId: orders.customerId,
        })
        .from(orders)
        .where(whereCondition)
        .orderBy(orders.createdAt);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ExportsService.fetchOrdersData.selectOrders",
          error,
          { dto },
        ),
        "Failed to fetch orders for export",
      );
      throw error;
    }

    // Enrich with customer info
    return Promise.all(
      ordersList.map(async (order) => {
        let customer:
          | {
              email: string;
              name: string | null;
              phone: string | null;
            }
          | undefined;
        try {
          const customerResult = await this.db
            .select({
              email: customers.email,
              name: customers.name,
              phone: customers.phone,
            })
            .from(customers)
            .where(eq(customers.id, order.customerId))
            .limit(1);
          customer = customerResult[0];
        } catch (error) {
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "ExportsService.fetchOrdersData.selectCustomer",
              error,
              { orderId: order.id, customerId: order.customerId },
            ),
            "Failed to fetch customer for order export, using N/A",
          );
          customer = undefined;
        }

        return {
          "Order ID": order.id,
          "Order Number": order.orderNumber,
          Customer: customer?.email || "N/A",
          "Customer Name": customer?.name || "N/A",
          "Customer Phone": customer?.phone || "N/A",
          Status: order.status,
          Subtotal: order.subtotal,
          "GST Amount": order.gstAmount,
          "Discount Amount": order.discountAmount,
          "Shipping Cost": order.shippingCost,
          Total: order.total,
          "Created At": order.createdAt.toISOString(),
        };
      }),
    );
  }

  private async fetchProductsData(
    dto: ExportProductsDto,
  ): Promise<Record<string, unknown>[]> {
    const conditions: ReturnType<typeof eq>[] = [];

    if (dto.categoryId) {
      conditions.push(eq(products.categoryId, dto.categoryId));
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    let productsList: Array<{
      id: string;
      title: string;
      price: number;
      status: string;
      createdAt: Date;
    }>;
    try {
      productsList = await this.db
        .select({
          id: products.id,
          title: products.title,
          price: products.price,
          status: products.status,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(whereCondition);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ExportsService.fetchProductsData.selectProducts",
          error,
          { dto },
        ),
        "Failed to fetch products for export",
      );
      throw error;
    }

    // Get variants for each product
    return Promise.all(
      productsList.map(async (product) => {
        let variants: Array<{
          id: string;
          sku: string | null;
          price: number;
          inventory: number;
        }>;
        try {
          variants = await this.db
            .select({
              id: productVariants.id,
              sku: productVariants.sku,
              price: productVariants.price,
              inventory: productVariants.inventory,
            })
            .from(productVariants)
            .where(eq(productVariants.productId, product.id));
        } catch (error) {
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "ExportsService.fetchProductsData.selectVariants",
              error,
              { productId: product.id },
            ),
            "Failed to fetch variants for product export, using empty array",
          );
          variants = [];
        }

        // Return one row per variant
        return variants.map((variant) => ({
          "Product ID": product.id,
          "Product Title": product.title,
          "Variant ID": variant.id,
          SKU: variant.sku,
          Price: variant.price || product.price,
          Stock: variant.inventory,
          Status: product.status,
          "Created At": product.createdAt.toISOString(),
        }));
      }),
    ).then((arrays) => arrays.flat());
  }

  private async fetchCustomersData(): Promise<Record<string, unknown>[]> {
    let customersList: Array<typeof customers.$inferSelect>;
    try {
      customersList = await this.db.select().from(customers);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ExportsService.fetchCustomersData.selectCustomers",
          error,
          {},
        ),
        "Failed to fetch customers for export",
      );
      throw error;
    }

    return customersList.map((customer) => ({
      "Customer ID": customer.id,
      Email: customer.email,
      Name: customer.name || "N/A",
      Phone: customer.phone || "N/A",
      "Created At": customer.createdAt.toISOString(),
      "Updated At": customer.updatedAt.toISOString(),
    }));
  }

  private async fetchInventoryData(): Promise<Record<string, unknown>[]> {
    const variants = await this.db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        productId: productVariants.productId,
        inventory: productVariants.inventory,
      })
      .from(productVariants);

    return Promise.all(
      variants.map(async (variant) => {
        const [product] = await this.db
          .select({ title: products.title })
          .from(products)
          .where(eq(products.id, variant.productId))
          .limit(1);

        const reserved = await this.inventoryStore.getReservedInventory(
          variant.id,
        );
        const available = Math.max(0, variant.inventory - (reserved || 0));

        return {
          "Variant ID": variant.id,
          SKU: variant.sku,
          "Product Title": product?.title || "N/A",
          Quantity: variant.inventory,
          Reserved: reserved || 0,
          Available: available,
        };
      }),
    );
  }

  // Header definitions
  private getOrderHeaders(): string[] {
    return ["Order ID", "Customer", "Total", "Status", "Created At"];
  }

  private getProductHeaders(): string[] {
    return ["Product ID", "Title", "SKU", "Price", "Stock"];
  }

  private getCustomerHeaders(): string[] {
    return ["Customer ID", "Email", "Name", "Phone", "Created At"];
  }

  private getInventoryHeaders(): string[] {
    return ["Variant ID", "SKU", "Quantity", "Reserved", "Available"];
  }
}
