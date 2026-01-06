import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";

export interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  handle: string;
  status: string;
  variants: ShopifyVariant[];
  images: Array<{ src: string; alt?: string }>;
  tags?: string;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku?: string;
  inventory_quantity?: number;
  option1?: string;
  option2?: string;
  option3?: string;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  tags?: string;
  created_at: string;
}

@Injectable()
export class ShopifyApiClient {
  private readonly baseUrl: string;
  private readonly apiVersion: string;

  constructor(
    private readonly config: ShopifyConfig,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    this.apiVersion = config.apiVersion || "2024-01";
    this.baseUrl = `https://${config.shopDomain}/admin/api/${this.apiVersion}`;
  }

  /**
   * Fetch products from Shopify
   */
  async fetchProducts(
    limit = 250,
    pageInfo?: string,
  ): Promise<{
    products: ShopifyProduct[];
    nextPageInfo?: string;
  }> {
    try {
      const url = new URL(`${this.baseUrl}/products.json`);
      url.searchParams.set("limit", limit.toString());
      if (pageInfo) {
        url.searchParams.set("page_info", pageInfo);
      }

      const response = await fetch(url.toString(), {
        headers: {
          "X-Shopify-Access-Token": this.config.accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Shopify API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const nextPageInfo = this.extractPageInfo(response.headers);

      return {
        products: data.products || [],
        nextPageInfo,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "fetchProducts", error, {
          limit,
          pageInfo,
        }),
        "Failed to fetch products from Shopify",
      );
      throw error;
    }
  }

  /**
   * Fetch customers from Shopify
   */
  async fetchCustomers(
    limit = 250,
    pageInfo?: string,
  ): Promise<{
    customers: ShopifyCustomer[];
    nextPageInfo?: string;
  }> {
    try {
      const url = new URL(`${this.baseUrl}/customers.json`);
      url.searchParams.set("limit", limit.toString());
      if (pageInfo) {
        url.searchParams.set("page_info", pageInfo);
      }

      const response = await fetch(url.toString(), {
        headers: {
          "X-Shopify-Access-Token": this.config.accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Shopify API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const nextPageInfo = this.extractPageInfo(response.headers);

      return {
        customers: data.customers || [],
        nextPageInfo,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "fetchCustomers", error, {
          limit,
          pageInfo,
        }),
        "Failed to fetch customers from Shopify",
      );
      throw error;
    }
  }

  /**
   * Extract pagination info from response headers
   */
  private extractPageInfo(headers: Headers): string | undefined {
    const linkHeader = headers.get("link");
    if (!linkHeader) {
      return undefined;
    }

    // Parse Link header for next page info
    const links = linkHeader.split(",");
    for (const link of links) {
      if (link.includes('rel="next"')) {
        const match = link.match(/<[^>]*page_info=([^&>]+)/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
      }
    }

    return undefined;
  }
}
