import { Injectable, OnModuleInit } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import * as nodemailer from "nodemailer";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { EmailTemplatesService } from "./email-templates.service";

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
  from?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter | null = null;
  private isEnabled: boolean = false;

  constructor(
    private readonly templatesService: EmailTemplatesService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    const emailEnabled =
      process.env.EMAIL_ENABLED === "true" || process.env.EMAIL_ENABLED === "1";

    if (!emailEnabled) {
      this.logger.info(
        createLogContext(this.contextService, "onModuleInit", {}),
        "Email service disabled - emails will be logged only",
      );
      return;
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpSecure = process.env.SMTP_SECURE === "true";
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpHost || !smtpUser || !smtpPassword) {
      this.logger.warn(
        createLogContext(this.contextService, "onModuleInit", {}),
        "SMTP configuration incomplete - emails will be logged only",
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });

      // Verify connection
      await this.transporter.verify();
      this.isEnabled = true;

      this.logger.info(
        createLogContext(this.contextService, "onModuleInit", {}),
        "Email service initialized successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "onModuleInit", error),
        "Failed to initialize email service - emails will be logged only",
      );
      this.transporter = null;
    }
  }

  /**
   * Send email
   * If email is disabled or SMTP not configured, logs the email instead
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, template, data, from } = options;

    // Render email template
    const html = await this.templatesService.render(template, data);
    const text = await this.templatesService.renderText(template, data);

    const fromAddress =
      from || process.env.EMAIL_FROM || "noreply@yourstore.com";

    if (!this.isEnabled || !this.transporter) {
      // Log email instead of sending
      this.logger.info(
        createLogContext(this.contextService, "sendEmail", {
          to,
          subject,
          template,
          from: fromAddress,
        }),
        `[EMAIL LOG] To: ${to}, Subject: ${subject}, Template: ${template}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        text,
      });

      this.logger.debug(
        createLogContext(this.contextService, "sendEmail", {
          to,
          subject,
          template,
        }),
        "Email sent successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "sendEmail", error, {
          to,
          subject,
          template,
        }),
        "Failed to send email",
      );
      // Don't throw - email failure shouldn't break the operation
    }
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(
    to: string,
    orderData: {
      orderNumber: string;
      orderId: string;
      total: number;
      items: Array<{
        name: string;
        quantity: number;
        price: number;
      }>;
      shippingAddress: {
        street: string;
        city: string;
        state: string;
        pincode: string;
      };
    },
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Order Confirmation - #${orderData.orderNumber}`,
      template: "order-confirmation",
      data: orderData,
    });
  }

  /**
   * Send order shipped email
   */
  async sendOrderShipped(
    to: string,
    orderData: {
      orderNumber: string;
      orderId: string;
      trackingNumber: string;
      awbNumber?: string;
      courierName?: string;
    },
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Your Order #${orderData.orderNumber} Has Been Shipped`,
      template: "order-shipped",
      data: orderData,
    });
  }

  /**
   * Send order delivered email
   */
  async sendOrderDelivered(
    to: string,
    orderData: {
      orderNumber: string;
      orderId: string;
      deliveredAt: Date;
    },
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Your Order #${orderData.orderNumber} Has Been Delivered`,
      template: "order-delivered",
      data: orderData,
    });
  }

  /**
   * Send abandoned cart recovery email
   */
  async sendAbandonedCartRecovery(
    to: string,
    data: {
      customerName: string;
      cartItems: Array<{
        name: string;
        quantity: number;
        price: number;
        thumbnail?: string | null;
      }>;
      cartTotal: number;
      discountCode?: string;
      cartLink: string;
    },
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: "Complete Your Purchase - Items Waiting!",
      template: "abandoned-cart-recovery",
      data,
    });
  }
}
