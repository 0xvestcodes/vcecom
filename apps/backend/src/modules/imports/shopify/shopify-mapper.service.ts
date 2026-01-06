import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { ShopifyCustomer, ShopifyProduct } from "./shopify-api.client";

export interface MappedProduct {
  title: string;
  description?: string;
  price: number;
  gstRate?: number;
  pricingType: "exclusive" | "inclusive";
  status: "draft" | "active" | "archived";
  variants: Array<{
    sku: string;
    price: number;
    inventory: number;
    title: string;
  }>;
}

export interface MappedCustomer {
  email: string;
  name: string;
  phone: string;
  gstin?: string;
}

@Injectable()
export class ShopifyMapperService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
  ) {}

  /**
   * Map Shopify product to internal product format
   */
  mapProduct(shopifyProduct: ShopifyProduct): MappedProduct {
    // Use first variant price as base price
    const baseVariant = shopifyProduct.variants[0];
    const basePrice = baseVariant ? parseFloat(baseVariant.price) : 0;

    // Map status
    let status: "draft" | "active" | "archived" = "draft";
    if (shopifyProduct.status === "active") {
      status = "active";
    } else if (shopifyProduct.status === "archived") {
      status = "archived";
    }

    // Map variants
    const variants = shopifyProduct.variants.map((variant) => ({
      sku: variant.sku || `SHOPIFY-${variant.id}`,
      price: parseFloat(variant.price),
      inventory: variant.inventory_quantity || 0,
      title: variant.title || shopifyProduct.title,
    }));

    return {
      title: shopifyProduct.title,
      description: shopifyProduct.body_html
        ? this.stripHtml(shopifyProduct.body_html)
        : undefined,
      price: basePrice,
      gstRate: 0, // Default, can be configured
      pricingType: "exclusive",
      status,
      variants,
    };
  }

  /**
   * Map Shopify customer to internal customer format
   */
  mapCustomer(shopifyCustomer: ShopifyCustomer): MappedCustomer {
    const firstName = shopifyCustomer.first_name || "";
    const lastName = shopifyCustomer.last_name || "";
    const name = `${firstName} ${lastName}`.trim() || shopifyCustomer.email;

    return {
      email: shopifyCustomer.email,
      name,
      phone: shopifyCustomer.phone || "0000000000", // Default phone if missing
      gstin: undefined, // Shopify doesn't have GSTIN field
    };
  }

  /**
   * Strip HTML tags from description
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
  }
}
