import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { CashfreeWebhookEventDto } from "./dto/cashfree-webhook-event.dto";
import {
  CashfreeOrderResponseDto,
  CreateCashfreeOrderDto,
} from "./dto/create-cashfree-order.dto";
import {
  CreatePayUOrderDto,
  PayUOrderResponseDto,
} from "./dto/create-payu-order.dto";
import {
  CreateRazorpayOrderDto,
  RazorpayOrderResponseDto,
} from "./dto/create-razorpay-order.dto";
import { PayUWebhookEventDto } from "./dto/payu-webhook-event.dto";
import {
  CashfreePaymentVerificationResponseDto,
  VerifyCashfreePaymentDto,
} from "./dto/verify-cashfree-payment.dto";
import {
  PaymentVerificationResponseDto,
  VerifyPaymentDto,
} from "./dto/verify-payment.dto";
import {
  PayUPaymentVerificationResponseDto,
  VerifyPayUPaymentDto,
} from "./dto/verify-payu-payment.dto";
import { RazorpayWebhookEventDto } from "./dto/webhook-event.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("store")
@Controller("store/payments")
export class StorePaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("razorpay/status")
  @SetMetadata(IS_PUBLIC_KEY, true)
  @ApiOperation({
    summary: "Get Razorpay initialization status",
    description:
      "Public endpoint to check if Razorpay is initialized. Useful for debugging payment issues.",
  })
  @ApiResponse({
    status: 200,
    description: "Razorpay status",
    schema: {
      type: "object",
      properties: {
        initialized: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Razorpay is initialized",
        },
      },
    },
  })
  getRazorpayStatus() {
    const isInitialized = this.paymentsService.isInitialized();
    return {
      initialized: isInitialized,
      message: isInitialized
        ? "Razorpay is initialized"
        : "Razorpay is not initialized. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.",
    };
  }

  @Post("razorpay/test")
  @SetMetadata(IS_PUBLIC_KEY, true)
  @ApiOperation({
    summary: "Test Razorpay API call (for debugging)",
    description:
      "Tests creating a Razorpay order with a small amount. Useful for debugging payment issues.",
  })
  @ApiResponse({
    status: 200,
    description: "Test result",
  })
  async testRazorpay() {
    try {
      const razorpay = this.paymentsService.getRazorpayInstance();
      console.log("[Test] Creating test Razorpay order...");

      const testOrder = await razorpay.orders.create({
        amount: 100, // 1 rupee in paise (minimum)
        currency: "INR",
        receipt: `test-${Date.now()}`,
      });

      console.log("[Test] Razorpay order created:", testOrder.id);

      return {
        success: true,
        orderId: testOrder.id,
        message: "Razorpay API call successful",
      };
    } catch (error) {
      console.error("[Test] Razorpay API call failed:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : String(error),
        message: "Razorpay API call failed",
      };
    }
  }

  @Post("razorpay/orders")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create Razorpay order for payment",
    description:
      "Creates a Razorpay order for an existing system order. This generates a payment order that can be used for Razorpay checkout.",
  })
  @ApiResponse({
    status: 201,
    description: "Razorpay order created successfully",
    type: RazorpayOrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request (order already has Razorpay order, invalid amount, etc.)",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async createRazorpayOrder(
    @Body() createRazorpayOrderDto: CreateRazorpayOrderDto,
  ): Promise<RazorpayOrderResponseDto> {
    return this.paymentsService.createRazorpayOrder(createRazorpayOrderDto);
  }

  @Post("razorpay/verify")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Verify Razorpay payment signature",
    description:
      "Verifies the payment signature received from Razorpay after a successful payment. This ensures the payment is authentic and not tampered with.",
  })
  @ApiResponse({
    status: 200,
    description: "Payment verification result",
    type: PaymentVerificationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request (invalid signature format, missing key secret, etc.)",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async verifyPayment(
    @Body() verifyPaymentDto: VerifyPaymentDto,
  ): Promise<PaymentVerificationResponseDto> {
    return this.paymentsService.verifyPayment(verifyPaymentDto);
  }

  @Post("razorpay/webhook")
  @SetMetadata(IS_PUBLIC_KEY, true)
  @RateLimit(RATE_LIMIT_PRESETS.WEBHOOK)
  @ApiOperation({
    summary: "Handle Razorpay webhook events",
    description:
      "Receives and processes webhook events from Razorpay. This endpoint should be configured in Razorpay dashboard. Webhook signature is verified for security.",
  })
  @ApiHeader({
    name: "x-razorpay-signature",
    description: "Razorpay webhook signature",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Webhook processed successfully",
    schema: {
      type: "object",
      properties: {
        processed: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Event payment.captured processed successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request (invalid signature, missing webhook secret, etc.)",
  })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-razorpay-signature") signature: string,
  ): Promise<{ processed: boolean; message: string }> {
    if (!signature) {
      throw new BadRequestException("Missing x-razorpay-signature header");
    }

    // Get raw body for signature verification
    // Razorpay signs the raw request body, not the parsed JSON
    let rawBody: string | Buffer;
    if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
      rawBody = req.rawBody;
    } else if (typeof req.body === "string") {
      rawBody = req.body;
    } else {
      throw new BadRequestException(
        "Raw request body is required for webhook signature verification",
      );
    }

    // Parse body for event processing
    let webhookEvent: RazorpayWebhookEventDto;
    if (Buffer.isBuffer(rawBody)) {
      webhookEvent = JSON.parse(rawBody.toString()) as RazorpayWebhookEventDto;
    } else {
      webhookEvent = JSON.parse(rawBody) as RazorpayWebhookEventDto;
    }

    return this.paymentsService.handleWebhook(webhookEvent, signature, rawBody);
  }

  @Post("cashfree/orders")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create Cashfree order for payment",
    description:
      "Creates a Cashfree order for an existing system order. This generates a payment order that can be used for Cashfree checkout.",
  })
  @ApiResponse({
    status: 201,
    description: "Cashfree order created successfully",
    type: CashfreeOrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request (order already has Cashfree order, invalid amount, etc.)",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async createCashfreeOrder(
    @Body() createCashfreeOrderDto: CreateCashfreeOrderDto,
  ): Promise<CashfreeOrderResponseDto> {
    return this.paymentsService.createCashfreeOrder(createCashfreeOrderDto);
  }

  @Post("cashfree/verify")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Verify Cashfree payment signature",
    description:
      "Verifies the payment signature received from Cashfree after a successful payment. This ensures the payment is authentic and not tampered with.",
  })
  @ApiResponse({
    status: 200,
    description: "Payment verification result",
    type: CashfreePaymentVerificationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request (invalid signature format, missing key secret, etc.)",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async verifyCashfreePayment(
    @Body() verifyCashfreePaymentDto: VerifyCashfreePaymentDto,
  ): Promise<CashfreePaymentVerificationResponseDto> {
    return this.paymentsService.verifyCashfreePayment(verifyCashfreePaymentDto);
  }

  @Post("cashfree/webhook")
  @SetMetadata(IS_PUBLIC_KEY, true)
  @RateLimit(RATE_LIMIT_PRESETS.WEBHOOK)
  @ApiOperation({
    summary: "Handle Cashfree webhook events",
    description:
      "Receives and processes webhook events from Cashfree. This endpoint should be configured in Cashfree dashboard. Webhook signature is verified for security.",
  })
  @ApiHeader({
    name: "x-cashfree-signature",
    description: "Cashfree webhook signature",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Webhook processed successfully",
    schema: {
      type: "object",
      properties: {
        processed: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Event PAYMENT_SUCCESS_WEBHOOK processed successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request (invalid signature, missing webhook secret, etc.)",
  })
  async handleCashfreeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-cashfree-signature") signature: string,
  ): Promise<{ processed: boolean; message: string }> {
    if (!signature) {
      throw new BadRequestException("Missing x-cashfree-signature header");
    }

    // Get raw body for signature verification
    let rawBody: string | Buffer;
    if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
      rawBody = req.rawBody;
    } else if (typeof req.body === "string") {
      rawBody = req.body;
    } else {
      throw new BadRequestException(
        "Raw request body is required for webhook signature verification",
      );
    }

    // Parse body for event processing
    let webhookEvent: CashfreeWebhookEventDto;
    if (Buffer.isBuffer(rawBody)) {
      webhookEvent = JSON.parse(rawBody.toString()) as CashfreeWebhookEventDto;
    } else {
      webhookEvent = JSON.parse(rawBody) as CashfreeWebhookEventDto;
    }

    return this.paymentsService.handleCashfreeWebhook(
      webhookEvent,
      signature,
      rawBody,
    );
  }

  @Post("payu/orders")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create PayU order for payment",
    description:
      "Creates a PayU payment order for an existing system order. This generates a payment hash and URL that can be used for PayU checkout.",
  })
  @ApiResponse({
    status: 201,
    description: "PayU order created successfully",
    type: PayUOrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request (order already has PayU transaction ID, invalid amount, etc.)",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async createPayUOrder(
    @Body() createPayUOrderDto: CreatePayUOrderDto,
  ): Promise<PayUOrderResponseDto> {
    return this.paymentsService.createPayUOrder(createPayUOrderDto);
  }

  @Post("payu/verify")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Verify PayU payment hash",
    description:
      "Verifies the payment hash received from PayU after a successful payment. This ensures the payment is authentic and not tampered with.",
  })
  @ApiResponse({
    status: 200,
    description: "Payment verification result",
    type: PayUPaymentVerificationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (invalid hash, etc.)",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async verifyPayUPayment(
    @Body() verifyPayUPaymentDto: VerifyPayUPaymentDto,
  ): Promise<PayUPaymentVerificationResponseDto> {
    const result =
      await this.paymentsService.verifyPayUPayment(verifyPayUPaymentDto);
    return {
      verified: result.verified,
      message: result.message,
    };
  }

  @Post("payu/webhook")
  @SetMetadata(IS_PUBLIC_KEY, true)
  @RateLimit(RATE_LIMIT_PRESETS.WEBHOOK)
  @ApiOperation({
    summary: "Handle PayU webhook events",
    description:
      "Receives and processes webhook events from PayU. This endpoint should be configured in PayU dashboard. Webhook hash is verified for security. PayU sends data as form-urlencoded, and the hash is included in the body.",
  })
  @ApiResponse({
    status: 200,
    description: "Webhook processed successfully",
    schema: {
      type: "object",
      properties: {
        processed: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Event with status success processed successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (invalid hash, missing webhook secret, etc.)",
  })
  async handlePayUWebhook(
    @Body() webhookEvent: PayUWebhookEventDto,
  ): Promise<{ processed: boolean; message: string }> {
    // PayU sends hash in the body, not as a header
    // The hash is included in webhookEvent.hash
    return this.paymentsService.handlePayUWebhook(
      webhookEvent,
      webhookEvent.hash || "",
    );
  }
}
