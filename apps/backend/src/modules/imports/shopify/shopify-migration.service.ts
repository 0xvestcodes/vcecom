import { Injectable, Optional } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { ImportSource, ImportType } from "../dto/imports.dto";
import { ImportsService } from "../imports.service";
import { ShopifyApiClient, ShopifyConfig } from "./shopify-api.client";
import { ShopifyMapperService } from "./shopify-mapper.service";

export interface MigrationProgress {
  totalProducts: number;
  processedProducts: number;
  totalCustomers: number;
  processedCustomers: number;
  errors: string[];
}

@Injectable()
export class ShopifyMigrationService {
  constructor(
    @Optional() readonly _shopifyApiClient: ShopifyApiClient | undefined,
    readonly _shopifyMapper: ShopifyMapperService,
    private readonly importsService: ImportsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Migrate products from Shopify
   */
  async migrateProducts(
    config: ShopifyConfig,
    userId: string,
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<{ jobId: string; totalProducts: number }> {
    try {
      const client = new ShopifyApiClient(
        config,
        this.logger,
        this.contextService,
      );
      const mapper = new ShopifyMapperService(this.logger, this.contextService);

      let totalProducts = 0;
      let pageInfo: string | undefined;
      const products: Array<{
        title: string;
        description?: string;
        price: string;
        gstRate?: string;
        pricingType: string;
        status: string;
      }> = [];

      // Fetch all products
      do {
        const result = await client.fetchProducts(250, pageInfo);
        totalProducts += result.products.length;

        for (const shopifyProduct of result.products) {
          const mapped = mapper.mapProduct(shopifyProduct);
          products.push({
            title: mapped.title,
            description: mapped.description,
            price: mapped.price.toString(),
            gstRate: mapped.gstRate?.toString(),
            pricingType: mapped.pricingType,
            status: mapped.status,
          });
        }

        pageInfo = result.nextPageInfo;

        if (onProgress) {
          onProgress({
            totalProducts,
            processedProducts: products.length,
            totalCustomers: 0,
            processedCustomers: 0,
            errors: [],
          });
        }
      } while (pageInfo);

      // Create import job with products data
      // For now, we'll create a JSON import job
      // In a full implementation, you'd convert products to CSV/Excel format
      const importJob = await this.importsService.createImportJob(
        {
          type: ImportType.PRODUCTS,
          source: ImportSource.SHOPIFY,
          options: {
            updateExisting: false,
            skipErrors: true,
          },
        },
        userId,
      );

      return {
        jobId: importJob.id,
        totalProducts,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "migrateProducts", error, {
          config,
        }),
        "Failed to migrate products from Shopify",
      );
      throw error;
    }
  }

  /**
   * Migrate customers from Shopify
   */
  async migrateCustomers(
    config: ShopifyConfig,
    userId: string,
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<{ jobId: string; totalCustomers: number }> {
    try {
      const client = new ShopifyApiClient(
        config,
        this.logger,
        this.contextService,
      );
      const mapper = new ShopifyMapperService(this.logger, this.contextService);

      let totalCustomers = 0;
      let pageInfo: string | undefined;
      const customers: Array<{
        email: string;
        name: string;
        phone: string;
        gstin?: string;
      }> = [];

      // Fetch all customers
      do {
        const result = await client.fetchCustomers(250, pageInfo);
        totalCustomers += result.customers.length;

        for (const shopifyCustomer of result.customers) {
          const mapped = mapper.mapCustomer(shopifyCustomer);
          customers.push(mapped);
        }

        pageInfo = result.nextPageInfo;

        if (onProgress) {
          onProgress({
            totalProducts: 0,
            processedProducts: 0,
            totalCustomers,
            processedCustomers: customers.length,
            errors: [],
          });
        }
      } while (pageInfo);

      // Create import job
      const importJob = await this.importsService.createImportJob(
        {
          type: ImportType.CUSTOMERS,
          source: ImportSource.SHOPIFY,
          options: {
            updateExisting: false,
            skipErrors: true,
          },
        },
        userId,
      );

      return {
        jobId: importJob.id,
        totalCustomers,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "migrateCustomers", error, {
          config,
        }),
        "Failed to migrate customers from Shopify",
      );
      throw error;
    }
  }
}
