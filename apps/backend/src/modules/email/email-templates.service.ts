import * as fs from "node:fs";
import * as path from "node:path";
import { Injectable } from "@nestjs/common";
import * as handlebars from "handlebars";

@Injectable()
export class EmailTemplatesService {
  private readonly templatesDir: string;

  constructor() {
    // Templates directory - adjust path as needed
    this.templatesDir = path.join(
      process.cwd(),
      "apps/backend/src/modules/email/templates",
    );
  }

  /**
   * Render email template
   */
  async render(
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
      const templateContent = fs.readFileSync(templatePath, "utf-8");
      const template = handlebars.compile(templateContent);
      return template(data);
    } catch (_error) {
      // Fallback to simple text if template not found
      return this.renderText(templateName, data);
    }
  }

  /**
   * Render email template as plain text
   */
  async renderText(
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    // Simple text fallback
    if (templateName === "order-confirmation") {
      return `Order Confirmation\n\nOrder Number: ${data.orderNumber}\nTotal: ₹${data.total}\n\nThank you for your order!`;
    }
    if (templateName === "order-shipped") {
      return `Your Order #${data.orderNumber} has been shipped!\n\nTracking Number: ${data.trackingNumber}\n\nYou can track your order using the tracking number above.`;
    }
    if (templateName === "order-delivered") {
      return `Your Order #${data.orderNumber} has been delivered!\n\nDelivered on: ${data.deliveredAt}\n\nThank you for shopping with us!`;
    }
    if (templateName === "abandoned-cart-recovery") {
      const customerName = data.customerName || "Customer";
      const cartTotal = typeof data.cartTotal === "number" ? data.cartTotal : 0;
      const discountCode = data.discountCode;
      let message = `Hi ${customerName}!\n\nYou left items in your cart. Complete your purchase: ${data.cartLink}\n\n`;
      if (discountCode) {
        message += `Use code ${discountCode} to save!\n\n`;
      }
      message += `Total: ₹${cartTotal.toFixed(2)}\n\nThank you!`;
      return message;
    }
    return JSON.stringify(data, null, 2);
  }
}
