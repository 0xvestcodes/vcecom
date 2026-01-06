import { Injectable, OnModuleInit } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";

export interface SendSMSOptions {
  to: string;
  message: string;
  from?: string;
}

@Injectable()
export class SMSService implements OnModuleInit {
  private isEnabled: boolean = false;
  private provider: "twilio" | "aws-sns" | "mock" = "mock";

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    const smsEnabled = process.env.SMS_ENABLED === "true";
    const smsProvider = (process.env.SMS_PROVIDER || "mock") as
      | "twilio"
      | "aws-sns"
      | "mock";

    this.isEnabled = smsEnabled;
    this.provider = smsProvider;

    if (this.isEnabled && this.provider !== "mock") {
      this.logger.info(
        createLogContext(this.contextService, "onModuleInit", {
          provider: this.provider,
        }),
        `SMS service initialized with provider: ${this.provider}`,
      );
    } else {
      this.logger.info(
        createLogContext(this.contextService, "onModuleInit", {}),
        "SMS service initialized (disabled/mock mode - SMS will be logged)",
      );
    }
  }

  /**
   * Send SMS
   * If SMS is disabled or provider not configured, logs the SMS instead
   */
  async sendSMS(options: SendSMSOptions): Promise<void> {
    const { to, message, from } = options;

    const fromNumber = from || process.env.SMS_FROM_NUMBER || "+1234567890";

    if (!this.isEnabled || this.provider === "mock") {
      // Log SMS instead of sending
      this.logger.info(
        createLogContext(this.contextService, "sendSMS", {
          to,
          message,
          from: fromNumber,
          provider: this.provider,
        }),
        `[SMS LOG] To: ${to}, Message: ${message.substring(0, 50)}...`,
      );
      return;
    }

    try {
      if (this.provider === "twilio") {
        await this.sendViaTwilio(to, message, fromNumber);
      } else if (this.provider === "aws-sns") {
        await this.sendViaAWSSNS(to, message);
      }

      this.logger.debug(
        createLogContext(this.contextService, "sendSMS", {
          to,
          provider: this.provider,
        }),
        "SMS sent successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "sendSMS", error, {
          to,
          provider: this.provider,
        }),
        "Failed to send SMS",
      );
      // Don't throw - SMS failure shouldn't break the operation
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendViaTwilio(
    to: string,
    message: string,
    from: string,
  ): Promise<void> {
    // Twilio implementation would go here
    // For now, we'll just log it
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || from;

    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials not configured");
    }

    // TODO: Implement actual Twilio API call
    // const twilio = require('twilio')(accountSid, authToken);
    // await twilio.messages.create({
    //   body: message,
    //   from: twilioPhoneNumber,
    //   to: to
    // });

    this.logger.info(
      createLogContext(this.contextService, "sendViaTwilio", {
        to,
        from: twilioPhoneNumber,
      }),
      `[TWILIO SMS] To: ${to}, Message: ${message.substring(0, 50)}...`,
    );
  }

  /**
   * Send SMS via AWS SNS
   */
  private async sendViaAWSSNS(to: string, message: string): Promise<void> {
    // AWS SNS implementation would go here
    // For now, we'll just log it
    const region = process.env.AWS_SNS_REGION || "us-east-1";
    const accessKeyId = process.env.AWS_SNS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SNS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS SNS credentials not configured");
    }

    // TODO: Implement actual AWS SNS API call
    // const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
    // const snsClient = new SNSClient({ region, credentials: { accessKeyId, secretAccessKey } });
    // await snsClient.send(new PublishCommand({
    //   PhoneNumber: to,
    //   Message: message
    // }));

    this.logger.info(
      createLogContext(this.contextService, "sendViaAWSSNS", {
        to,
        region,
      }),
      `[AWS SNS SMS] To: ${to}, Message: ${message.substring(0, 50)}...`,
    );
  }

  /**
   * Send abandoned cart recovery SMS
   */
  async sendAbandonedCartRecovery(
    to: string,
    data: {
      customerName?: string;
      cartLink: string;
      discountCode?: string;
      cartTotal: number;
      itemCount: number;
    },
  ): Promise<void> {
    const { customerName, cartLink, discountCode, cartTotal, itemCount } = data;

    let message = `Hi${customerName ? ` ${customerName}` : ""}! You left items in your cart. `;
    message += `Complete your purchase: ${cartLink}`;

    if (discountCode) {
      message += ` Use code ${discountCode} for ${discountCode.includes("%") ? "" : "₹"}${discountCode.includes("%") ? discountCode : ""} off!`;
    }

    message += ` Total: ₹${cartTotal.toFixed(2)} (${itemCount} item${itemCount > 1 ? "s" : ""})`;

    await this.sendSMS({
      to,
      message,
    });
  }
}
