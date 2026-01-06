import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Request,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { customers, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { PAISE_PER_RUPEE } from "../../common/constants/currency.constants";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  NotFoundErrorDto,
  TooManyRequestsErrorDto,
} from "../../common/dto/error-response.dto";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { extractSessionId } from "../../common/utils/session.utils";
import type { Database } from "../../modules/database/db";
import { CartsService } from "../carts/carts.service";
import { DB_TOKEN } from "../database/database.module";
import { PaymentFeeBreakdownDto } from "../payments/dto/payment-charge.dto";
import {
  CodEligibilityContext,
  PaymentChargeService,
} from "../payments/services/payment-charge.service";
import { CheckoutStore } from "../redis-store/stores/checkout-store";
import { StoresService } from "../stores/stores.service";
import { LoyaltyService } from "../wallet/services/loyalty.service";
import { WalletService } from "../wallet/services/wallet.service";
import { CheckoutService } from "./checkout.service";
import {
  CheckoutAddressDto,
  CheckoutConfirmDto,
  CheckoutShippingDto,
  PaymentMethodWithFeeDto,
  SelectPaymentMethodDto,
  StartCheckoutDto,
} from "./dto/checkout.dto";
import {
  ApplyAddressResponseDto,
  ConfirmCheckoutResponseDto,
  SelectShippingResponseDto,
  StartCheckoutResponseDto,
} from "./dto/checkout-response.dto";

@ApiTags("store")
@Controller("store/checkout")
@Public()
export class CheckoutController {
  constructor(
    private readonly cartsService: CartsService,
    private readonly paymentChargeService: PaymentChargeService,
    private readonly checkoutStore: CheckoutStore,
    private readonly checkoutService: CheckoutService,
    private readonly storesService: StoresService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
    private readonly logger: PinoLogger,
    private readonly walletService?: WalletService,
    private readonly loyaltyService?: LoyaltyService,
  ) {}

  @Post("start")
  @RateLimit(RATE_LIMIT_PRESETS.PAYMENT_INTENT)
  @ApiOperation({
    summary: "Start checkout",
    description:
      "Creates checkout session, freezes cart, validates availability. Returns checkout session ID.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest checkout (required for guest checkout)",
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: "Checkout started successfully",
    type: StartCheckoutResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (empty cart, etc.)",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: "Conflict (cart already being checked out)",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async startCheckout(
    @Request() req: Request & {
      user?: { userId: string; email: string; role: string };
    },
    @Body() dto: StartCheckoutDto,
  ): Promise<StartCheckoutResponseDto> {
    const userId = req.user?.userId || null;
    const sessionId = extractSessionId(req);
    return this.checkoutService.startCheckout(userId, sessionId, dto);
  }

  @Post("address")
  @RateLimit(RATE_LIMIT_PRESETS.PAYMENT_INTENT)
  @ApiOperation({
    summary: "Apply shipping address to checkout",
    description:
      "Validates and stores shipping address in checkout session. Validates serviceability via Shiprocket.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest checkout (required for guest checkout)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Address applied successfully",
    type: ApplyAddressResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (invalid address, not serviceable, etc.)",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Checkout session not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 422,
    description:
      "Unprocessable entity - Invalid PIN code format or address validation failed",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async applyAddress(
    @Request() req: Request & {
      user?: { userId: string; email: string; role: string };
    },
    @Body() dto: CheckoutAddressDto,
  ) {
    const userId = req.user?.userId || null;
    const sessionId = extractSessionId(req);
    return this.checkoutService.applyAddress(userId, sessionId, dto);
  }

  @Get("shipping-methods")
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get available shipping methods",
    description:
      "Returns all available shipping methods for the given checkout session and address. Methods are filtered based on zone, state, order value, and COD availability.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest checkout (required for guest checkout)",
    required: false,
  })
  @ApiQuery({
    name: "checkoutSessionId",
    description: "Checkout session ID",
    required: false,
  })
  @ApiQuery({
    name: "pincode",
    description: "Shipping PIN code",
    required: false,
  })
  @ApiQuery({
    name: "state",
    description: "Shipping state",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Shipping methods retrieved successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (invalid session, etc.)",
  })
  async getShippingMethods(
    @Request() req: Request & {
      user?: { userId: string; email: string; role: string };
    },
    @Query("checkoutSessionId") checkoutSessionId?: string,
    @Query("pincode") pincode?: string,
    @Query("state") state?: string,
  ) {
    const userId = req.user?.userId || null;
    const sessionId = extractSessionId(req);
    return this.checkoutService.getAvailableShippingMethods(userId, sessionId, {
      checkoutSessionId: checkoutSessionId || undefined,
      pincode: pincode || undefined,
      state: state || undefined,
    });
  }

  @Post("shipping")
  @RateLimit(RATE_LIMIT_PRESETS.PAYMENT_INTENT)
  @ApiOperation({
    summary: "Select shipping method",
    description:
      "Selects shipping method and calculates delivery charges. Includes COD eligibility check and payment fee pre-computation.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest checkout (required for guest checkout)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Shipping method selected successfully",
    type: SelectShippingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (invalid method, etc.)",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Checkout session or shipping method not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - Shipping method not available for this address",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async selectShipping(
    @Request() req: Request & {
      user?: { userId: string; email: string; role: string };
    },
    @Body() dto: CheckoutShippingDto,
  ) {
    const userId = req.user?.userId || null;
    const sessionId = extractSessionId(req);
    return this.checkoutService.selectShipping(userId, sessionId, dto);
  }

  @Get("payment-methods")
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get available payment methods with fees",
    description:
      "Returns all available payment methods with calculated fees based on current cart total. Supports both authenticated and guest checkout. Payment method availability is dynamically determined based on cart content, shipping address, and restrictions.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest checkout (required for guest checkout)",
    required: false,
  })
  @ApiQuery({
    name: "checkoutSessionId",
    description: "Checkout session ID (optional)",
    required: false,
  })
  @ApiQuery({
    name: "shippingAddressId",
    description: "Shipping address ID for availability checks (optional)",
    required: false,
  })
  @ApiQuery({
    name: "country",
    description: "Shipping country for availability checks (optional)",
    required: false,
  })
  @ApiQuery({
    name: "state",
    description: "Shipping state for availability checks (optional)",
    required: false,
  })
  @ApiQuery({
    name: "pincode",
    description: "Shipping PIN code for availability checks (optional)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Payment methods retrieved successfully",
    type: [PaymentMethodWithFeeDto],
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (empty cart, etc.)",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async getPaymentMethods(
    @Request() req: Request & {
      user?: { userId: string; email: string; role: string };
    },
    @Query("checkoutSessionId") checkoutSessionId?: string,
    @Query("shippingAddressId") shippingAddressId?: string,
    @Query("country") country?: string,
    @Query("state") state?: string,
    @Query("pincode") pincode?: string,
  ): Promise<{ methods: PaymentMethodWithFeeDto[] }> {
    const userId = req.user?.userId || null;
    const sessionId = extractSessionId(req);

    this.logger.info(
      {
        userId: userId || null,
        hasSessionId: !!sessionId,
        checkoutSessionId,
      },
      "getPaymentMethods called",
    );

    // If neither userId nor sessionId is provided, return empty methods list
    if (!userId && !sessionId) {
      this.logger.info("No userId or sessionId, returning empty methods");
      return { methods: [] };
    }

    // Get cart
    const cart = await this.cartsService.getCart(userId, sessionId);

    // Calculate cart total in paise (convert from INR)
    // Use 0 if cart is empty or doesn't exist
    const cartTotalInPaise = cart?.total
      ? Math.round(cart.total * PAISE_PER_RUPEE)
      : 0;

    // Convert cart items to format expected by payment charge service
    // Use empty array if cart is empty or doesn't exist
    const cartItems =
      cart?.items && cart.items.length > 0
        ? cart.items.map((item) => ({
            productVariantId: item.variantId, // Use variantId from enriched item
            quantity: item.quantity,
            price: item.pricing.unitPrice, // Use unitPrice from pricing breakdown
            metadata: (item as { metadata?: unknown }).metadata,
          }))
        : [];

    // Build COD eligibility context
    const context: CodEligibilityContext = {};

    // Get shipping address info if provided
    if (shippingAddressId || country || state || pincode) {
      context.shippingAddress = {
        country: country || undefined,
        state: state || undefined,
        pincode: pincode || undefined,
      };

      // If shippingAddressId provided, fetch full address details
      if (shippingAddressId) {
        try {
          const { addresses } = await import("@vcecom/db");
          const [address] = await this.db
            .select({
              country: addresses.country,
              state: addresses.state,
              pincode: addresses.pincode,
            })
            .from(addresses)
            .where(eq(addresses.id, shippingAddressId))
            .limit(1);

          if (address) {
            context.shippingAddress = {
              country: address.country || country,
              state: address.state || state,
              pincode: address.pincode || pincode,
            };
          }
        } catch (_error) {
          // Log but continue - address fetch failure shouldn't break payment methods
        }
      }
    }

    // Get customer group IDs if user is authenticated
    if (userId && cart.customerId) {
      try {
        const [customer] = await this.db
          .select({ customerGroupId: customers.customerGroupId })
          .from(customers)
          .where(eq(customers.id, cart.customerId))
          .limit(1);

        if (customer?.customerGroupId) {
          context.customerGroupIds = [customer.customerGroupId];
        }
      } catch (_error) {
        // Log but continue - customer group fetch failure shouldn't break payment methods
      }
    }

    // Get available payment methods with fees and restrictions
    this.logger.info(
      {
        cartTotalInPaise,
        cartItemsCount: cartItems.length,
        hasContext: !!context,
      },
      "Calling paymentChargeService.getAvailableMethods",
    );

    // Get currency from cart or store default
    const cartCurrency = cart.currency || "INR";
    const store = await this.storesService.getStore();
    const currency = cartCurrency || store.currency || "INR";

    const methods = await this.paymentChargeService.getAvailableMethods(
      cartTotalInPaise,
      currency,
      cartItems,
      context,
    );

    this.logger.info(
      {
        methodsReturned: methods.length,
        methods: methods.map((m) => ({
          method: m.method,
          available: m.available,
        })),
      },
      "Returning payment methods from controller",
    );

    return { methods };
  }

  @Post("payment")
  @RateLimit(RATE_LIMIT_PRESETS.PAYMENT_INTENT)
  @ApiOperation({
    summary: "Select payment method for checkout",
    description:
      "Selects a payment method and calculates the fee. Stores payment method and fee in checkout session for order creation.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest checkout (required for guest checkout)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Payment method selected successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (invalid method, cart empty, etc.)",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Checkout session not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - Payment method not available for this order",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async selectPaymentMethod(
    @Request() req: Request & {
      user?: { userId: string; email: string; role: string };
    },
    @Body() dto: SelectPaymentMethodDto,
  ): Promise<{
    success: boolean;
    fee: number;
    breakdown: PaymentFeeBreakdownDto;
  }> {
    const userId = req.user?.userId || null;
    const sessionId = extractSessionId(req);

    // Get cart
    const cart = await this.cartsService.getCart(userId, sessionId);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    // Calculate cart total in paise
    const cartTotalInPaise = Math.round(cart.total * PAISE_PER_RUPEE);

    // Get currency from cart or store default
    const cartCurrency = cart.currency || "INR";
    const store = await this.storesService.getStore();
    const currency = cartCurrency || store.currency || "INR";

    // Calculate fee for selected method
    const { fee, breakdown } = await this.paymentChargeService.calculateFee(
      dto.paymentMethod,
      cartTotalInPaise,
      currency,
    );

    // If checkout session exists, update it with payment method and fee
    if (dto.checkoutSessionId) {
      const session = await this.checkoutStore.getSession(
        dto.checkoutSessionId,
      );
      if (!session) {
        throw new BadRequestException(
          `Checkout session ${dto.checkoutSessionId} not found`,
        );
      }
      // Update checkout metadata with payment method and fee
      const metadata = await this.checkoutStore.getCheckoutMetadata(
        dto.checkoutSessionId,
      );
      if (!metadata) {
        throw new BadRequestException(
          `Checkout metadata for session ${dto.checkoutSessionId} not found`,
        );
      }
      // Store fee in paise in metadata (for database consistency)
      await this.checkoutStore.storeCheckoutMetadata(dto.checkoutSessionId, {
        ...metadata,
        paymentMethod: dto.paymentMethod,
        paymentFee: fee, // Store in paise for database consistency
        paymentFeeBreakdown: breakdown, // Breakdown also in paise
      });
    }

    // Return fee in rupees for API response
    return {
      success: true,
      fee: fee / PAISE_PER_RUPEE, // Convert from paise to rupees
      breakdown: {
        ...breakdown,
        flatAmount: breakdown.flatAmount
          ? breakdown.flatAmount / PAISE_PER_RUPEE
          : undefined,
        calculatedFee: breakdown.calculatedFee / PAISE_PER_RUPEE,
        mixMin: breakdown.mixMin
          ? breakdown.mixMin / PAISE_PER_RUPEE
          : undefined,
        mixCap: breakdown.mixCap
          ? breakdown.mixCap / PAISE_PER_RUPEE
          : undefined,
      },
    };
  }

  @Post("confirm")
  @RateLimit(RATE_LIMIT_PRESETS.PAYMENT_INTENT)
  @ApiOperation({
    summary: "Confirm order",
    description:
      "Final step: creates order, locks inventory, generates payment intent. Returns orderId, paymentIntentId, and redirectUrl.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest checkout (required for guest checkout)",
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: "Order confirmed successfully",
    type: ConfirmCheckoutResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (invalid session, insufficient inventory, etc.)",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Checkout session not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 409,
    description:
      "Conflict - Checkout session in invalid state or order already created",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 422,
    description: "Unprocessable entity - Missing required checkout information",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async confirmCheckout(
    @Request() req: Request & {
      user?: { userId: string; email: string; role: string };
    },
    @Body() dto: CheckoutConfirmDto,
  ) {
    const userId = req.user?.userId || null;
    const sessionId = extractSessionId(req);
    return this.checkoutService.confirmCheckout(userId, sessionId, dto);
  }

  @Get("wallet-balance")
  @RateLimit(RATE_LIMIT_PRESETS.READ)
  @ApiOperation({
    summary: "Get wallet balance for checkout",
    description:
      "Get current wallet balance and loyalty points for authenticated customer",
  })
  @ApiResponse({
    status: 200,
    description: "Wallet balance retrieved successfully",
  })
  async getWalletBalance(
    @Request() req: Request & {
      user?: { userId: string; email: string; role: string };
    },
  ) {
    if (!req.user?.userId || !this.walletService) {
      return { walletBalance: 0, loyaltyPoints: 0 };
    }

    // Get customer ID from user ID
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.userId, req.user.userId))
      .limit(1);

    if (!customer) {
      return { walletBalance: 0, loyaltyPoints: 0 };
    }

    const balance = await this.walletService.getBalance(customer.id);
    const points = await this.loyaltyService?.getPointsBalance(customer.id);

    return {
      walletBalance: balance.walletBalance,
      loyaltyPoints: points?.points || 0,
    };
  }
}
