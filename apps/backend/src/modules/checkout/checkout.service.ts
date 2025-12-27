import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { addresses, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { isCodPayment } from "../../common/constants/orders.constants";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import { safeAddressStateLookup } from "../../common/utils/address-lookup";
import {
  formatPincode,
  isValidPincodeFormat,
  ServiceabilityResult,
} from "../../common/utils/pincode.utils";
import type { Database } from "../../modules/database/db";
import { CartsService } from "../carts/carts.service";
import { AddressesService } from "../customers/addresses.service";
import { DB_TOKEN } from "../database/database.module";
import { CreateOrderDto } from "../orders/dto/create-order.dto";
import { OrdersService } from "../orders/orders.service";
import { CheckoutState } from "../redis-store/constants/checkout-states";
import { CheckoutMetadata } from "../redis-store/dto/checkout-metadata.dto";
import { CheckoutStore } from "../redis-store/stores/checkout-store";
import { ShippingMethodsService } from "../shipping/shipping-methods.service";
import {
  ShippingCalculation,
  ShippingRulesService,
} from "../shipping/shipping-rules.service";
import {
  CheckoutAddressDto,
  CheckoutConfirmDto,
  CheckoutShippingDto,
  StartCheckoutDto,
} from "./dto/checkout.dto";

/**
 * Extended checkout metadata with custom fields for guest checkout
 * These fields are stored in Redis but not part of the base CheckoutMetadata interface
 */
interface ExtendedCheckoutMetadata extends CheckoutMetadata {
  _shippingAddress?: {
    name: string;
    email: string;
    phone: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  _guestEmail?: string;
  _guestPassword?: string; // Password for account creation during checkout
  _serviceability?: ServiceabilityResult;
  _shippingMethodId?: string;
  _shippingCalculation?: ShippingCalculation;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly cartsService: CartsService,
    private readonly checkoutStore: CheckoutStore,
    private readonly shippingRulesService: ShippingRulesService,
    private readonly shippingMethodsService: ShippingMethodsService,
    private readonly addressesService: AddressesService,
    private readonly ordersService: OrdersService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Start checkout - creates session, freezes cart, validates availability
   */
  @Trace({ operation: "CheckoutService.startCheckout" })
  async startCheckout(
    userId: string | null,
    sessionId: string | null,
    dto: StartCheckoutDto,
  ) {
    // Get cart
    const cart = await this.cartsService.getCart(userId, sessionId);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    // Validate cart ID matches
    if (cart.id !== dto.cartId) {
      throw new BadRequestException("Cart ID mismatch");
    }

    // Check if cart is already locked and handle stale/early state locks
    const isLocked = await this.checkoutStore.isCheckoutLocked(cart.id);
    if (isLocked) {
      // Check if there's an active checkout session for this cart
      // Use getSessionByCartId which is more reliable than hasActiveCheckoutSession
      let existingSession = await this.checkoutStore.getSessionByCartId(
        cart.id,
      );

      // If no session found immediately, wait a bit and retry (handles race condition)
      if (!existingSession) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        existingSession = await this.checkoutStore.getSessionByCartId(cart.id);
      }

      if (!existingSession) {
        // Stale lock detected - no active session found, release it and allow checkout to proceed
        this.logger.warn(
          `Stale checkout lock detected for cartId=${cart.id}, releasing lock`,
        );
        await this.checkoutStore.releaseCheckoutLock(cart.id);
      } else {
        // Check the session state - only block if it's in a payment-related state
        const { CheckoutState } = await import(
          "../redis-store/constants/checkout-states"
        );

        const blockingStates = [
          CheckoutState.PAYMENT_PENDING,
          CheckoutState.PAYMENT_CONFIRMED,
          CheckoutState.ORDER_CREATED,
          CheckoutState.COMPLETED,
        ];

        this.logger.debug(
          `Found existing checkout session for cartId=${cart.id}, state=${existingSession.session.state}`,
        );

        if (blockingStates.includes(existingSession.session.state)) {
          // Active session in payment state - cart is legitimately locked
          throw new ConflictException("Cart is already being checked out");
        } else {
          // Session exists but in early state (CREATED, LOCKED) - release lock and allow new checkout
          this.logger.info(
            `Existing checkout session for cartId=${cart.id} is in early state (${existingSession.session.state}), cleaning up old session and allowing new checkout`,
          );

          // Release lock first
          await this.checkoutStore.releaseCheckoutLock(cart.id);

          // Handle session cleanup based on state
          const { CheckoutState } = await import(
            "../redis-store/constants/checkout-states"
          );

          if (existingSession.session.state === CheckoutState.CREATED) {
            // CREATED state can't transition to FAILED directly
            // Delete the session directly since it hasn't progressed far
            await this.checkoutStore.deleteCheckoutSession(
              existingSession.sessionId,
            );
          } else {
            // LOCKED state can transition to FAILED
            await this.checkoutStore.failSession(existingSession.sessionId);
          }

          // Small delay to ensure Redis processes the lock release
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }

    // Acquire checkout lock FIRST before creating session
    // This prevents race conditions where lock is acquired between check and acquire
    let lockAcquired = await this.checkoutStore.acquireCheckoutLock(cart.id);

    // Retry lock acquisition with small delay if it fails (handles race conditions)
    if (!lockAcquired) {
      this.logger.debug(
        `Lock acquisition failed for cartId=${cart.id}, retrying after short delay`,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      lockAcquired = await this.checkoutStore.acquireCheckoutLock(cart.id);
    }

    if (!lockAcquired) {
      // Still failed after retry - check if there's a legitimate active session
      const existingSession = await this.checkoutStore.getSessionByCartId(
        cart.id,
      );
      if (existingSession) {
        const { CheckoutState } = await import(
          "../redis-store/constants/checkout-states"
        );
        const blockingStates = [
          CheckoutState.PAYMENT_PENDING,
          CheckoutState.PAYMENT_CONFIRMED,
          CheckoutState.ORDER_CREATED,
          CheckoutState.COMPLETED,
        ];
        if (blockingStates.includes(existingSession.session.state)) {
          throw new ConflictException("Cart is already being checked out");
        }
      }
      throw new ConflictException("Failed to lock cart for checkout");
    }

    // Create checkout session AFTER lock is acquired
    // This ensures we have the lock before creating the session
    const { sessionId: checkoutSessionId } =
      await this.checkoutStore.createSession(cart.id);

    // Store initial metadata (will be extended as checkout progresses)
    // Note: CheckoutMetadata requires customerId, so we'll create a guest customer later if needed
    // For now, store minimal metadata
    const initialMetadata: ExtendedCheckoutMetadata = {
      customerId: cart.customerId || "temp", // Will be replaced with actual guest customer ID
      userId: userId || null,
      shippingAddressId: "temp",
      billingAddressId: "temp",
      shippingCost: 0,
      discountSnapshot: null,
      pricingSnapshot: null,
      createdAt: new Date().toISOString(),
      // Store guest email in a custom field (will be handled during order creation)
      _guestEmail: dto.guestEmail,
    };
    await this.checkoutStore.storeCheckoutMetadata(
      checkoutSessionId,
      initialMetadata,
    );

    // Transition session to LOCKED state
    const currentSession =
      await this.checkoutStore.getSession(checkoutSessionId);
    if (currentSession) {
      await this.checkoutStore.transitionState(
        checkoutSessionId,
        currentSession.state,
        CheckoutState.LOCKED,
      );
    }

    return {
      checkoutSessionId,
      cartId: cart.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      totals: {
        subtotal: cart.subtotal,
        discount: cart.discountAmount || 0,
        total: cart.total,
      },
    };
  }

  /**
   * Apply shipping address to checkout
   */
  async applyAddress(
    userId: string | null,
    sessionId: string | null,
    dto: CheckoutAddressDto,
  ) {
    // Get checkout session
    const session = await this.checkoutStore.getSession(dto.checkoutSessionId);
    if (!session) {
      throw new NotFoundException(
        "Checkout session not found. Please start a new checkout.",
      );
    }

    // Check if session has failed
    if (session.state === CheckoutState.FAILED) {
      throw new BadRequestException(
        "Checkout session has failed. Please start a new checkout from your cart.",
      );
    }

    // Assert session is in LOCKED state
    await this.checkoutStore.assertState(
      dto.checkoutSessionId,
      CheckoutState.LOCKED,
    );

    // Validate PIN code format
    const formattedPincode = formatPincode(dto.pincode);
    if (!isValidPincodeFormat(formattedPincode)) {
      throw new BadRequestException(
        "Invalid PIN code format. PIN code must be exactly 6 digits",
      );
    }

    // Check serviceability via Shiprocket/database
    const serviceability =
      await this.shippingRulesService.checkServiceability(formattedPincode);
    if (!serviceability.isValid || !serviceability.isServiceable) {
      throw new BadRequestException(
        `PIN code ${formattedPincode} is not serviceable`,
      );
    }

    // Create or get address
    let addressId: string | null = null;
    if (userId) {
      // For authenticated users, create address
      const address = await this.addressesService.create(userId, {
        type: "shipping",
        street: `${dto.address1}${dto.address2 ? `, ${dto.address2}` : ""}`,
        city: dto.city,
        state: dto.state,
        pincode: formattedPincode,
        district: dto.city,
        country: dto.country || "India",
      });
      addressId = address.id;
    }

    // Store address in checkout metadata
    // Extend metadata with address data (stored as custom fields for guest checkout)
    const metadata = await this.checkoutStore.getCheckoutMetadata(
      dto.checkoutSessionId,
    );
    if (!metadata) {
      throw new BadRequestException("Checkout metadata not found");
    }

    const updatedMetadata: ExtendedCheckoutMetadata = {
      ...metadata,
      shippingAddressId: addressId || metadata.shippingAddressId,
      billingAddressId: addressId || metadata.billingAddressId,
      // Store guest address data in custom fields
      _shippingAddress: userId
        ? undefined
        : {
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            address1: dto.address1,
            address2: dto.address2,
            city: dto.city,
            state: dto.state,
            pincode: formattedPincode,
            country: dto.country || "India",
          },
      _guestEmail: userId ? undefined : dto.email,
      _guestPassword: userId ? undefined : dto.password, // Store password for account creation
      _serviceability: serviceability,
    };
    await this.checkoutStore.storeCheckoutMetadata(
      dto.checkoutSessionId,
      updatedMetadata,
    );

    // Auto-select shipping method if only one is available
    // This ensures the shipping method is saved in backend before frontend proceeds
    let autoSelectedShippingMethodId: string | undefined;
    try {
      const cart = await this.cartsService.getCart(userId, sessionId);
      if (cart && cart.items.length > 0) {
        const cartTotal = cart.total;
        const cartWeight = cart.items.reduce((total, item) => {
          return total + item.quantity * 0.5; // Default 0.5kg per item
        }, 0);

        const availableMethods =
          await this.shippingMethodsService.getAvailableMethods({
            pincode: formattedPincode,
            state: dto.state,
            cartTotal,
            cartWeight,
            isCod: false, // Will be determined by payment method selection
          });

        // If only one shipping method is available, auto-select it
        if (availableMethods.length === 1) {
          const method = availableMethods[0];
          const selectedMethod = availableMethods.find(
            (m) => m.id === method.id,
          );

          if (selectedMethod) {
            // Update metadata with shipping method and cost
            const finalMetadata: ExtendedCheckoutMetadata = {
              ...updatedMetadata,
              shippingCost: selectedMethod.cost,
              _shippingMethodId: method.id,
            };
            await this.checkoutStore.storeCheckoutMetadata(
              dto.checkoutSessionId,
              finalMetadata,
            );

            autoSelectedShippingMethodId = method.id;

            this.logger.debug(
              `Auto-selected shipping method ${method.id} for checkout session ${dto.checkoutSessionId}`,
            );
          }
        }
      }
    } catch (error) {
      // Log error but don't fail address application if auto-selection fails
      this.logger.warn(
        `Failed to auto-select shipping method for checkout session ${dto.checkoutSessionId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return {
      success: true,
      addressId: userId ? addressId : undefined,
      serviceability,
      autoSelectedShippingMethodId, // Inform frontend if shipping was auto-selected
      checkoutSessionId: dto.checkoutSessionId,
    };
  }

  /**
   * Get available shipping methods for checkout
   */
  @Trace({ operation: "CheckoutService.getAvailableShippingMethods" })
  async getAvailableShippingMethods(
    userId: string | null,
    sessionId: string | null,
    params: {
      checkoutSessionId?: string;
      pincode?: string;
      state?: string;
    },
  ) {
    let pincode: string | undefined = params.pincode;
    let state: string | undefined = params.state;
    let cartTotal = 0;
    let cartWeight = 0;

    // If checkoutSessionId is provided, get address and cart info from session
    if (params.checkoutSessionId) {
      const session = await this.checkoutStore.getSession(
        params.checkoutSessionId,
      );
      if (!session) {
        throw new NotFoundException("Checkout session not found");
      }

      // Get checkout metadata to get address
      const metadata = await this.checkoutStore.getCheckoutMetadata(
        params.checkoutSessionId,
      );
      if (metadata) {
        // Get pincode from address
        if (
          metadata.shippingAddressId &&
          metadata.shippingAddressId !== "temp"
        ) {
          try {
            const addressResult = await this.db
              .select({ pincode: addresses.pincode, state: addresses.state })
              .from(addresses)
              .where(eq(addresses.id, metadata.shippingAddressId))
              .limit(1);
            const address = addressResult[0];
            if (address) {
              pincode = address.pincode;
              state = address.state || undefined;
            }
          } catch (error) {
            this.logger.warn(
              createLogContext(
                this.contextService,
                "CheckoutService.getAvailableShippingMethods.addressLookup",
                {
                  checkoutSessionId: params.checkoutSessionId,
                  shippingAddressId: metadata.shippingAddressId,
                  error: error instanceof Error ? error.message : String(error),
                },
              ),
              "Failed to fetch address, continuing without pincode",
            );
          }
        } else {
          // Get from guest address
          const extendedMetadata = metadata as ExtendedCheckoutMetadata;
          const guestAddress = extendedMetadata._shippingAddress;
          if (guestAddress) {
            pincode = guestAddress.pincode;
            state = guestAddress.state;
          }
        }
      }

      // Get cart to calculate total and weight
      const cart = await this.cartsService.getCart(userId, sessionId);
      if (cart) {
        cartTotal = cart.total;
        cartWeight = cart.items.reduce((total, item) => {
          return total + item.quantity * 0.5; // Default 0.5kg per item
        }, 0);
      }
    }

    // If pincode is not provided, return empty array
    if (!pincode) {
      return { methods: [] };
    }

    // Get available shipping methods
    const methods = await this.shippingMethodsService.getAvailableMethods({
      pincode,
      state,
      cartTotal,
      cartWeight,
      isCod: false, // Will be determined by payment method selection
    });

    return { methods };
  }

  /**
   * Select shipping method
   */
  @Trace({ operation: "CheckoutService.selectShipping" })
  async selectShipping(
    userId: string | null,
    sessionId: string | null,
    dto: CheckoutShippingDto,
  ) {
    // Get checkout session
    const session = await this.checkoutStore.getSession(dto.checkoutSessionId);
    if (!session) {
      throw new NotFoundException(
        "Checkout session not found. Please start a new checkout.",
      );
    }

    // Check if session has failed
    if (session.state === CheckoutState.FAILED) {
      throw new BadRequestException(
        "Checkout session has failed. Please start a new checkout from your cart.",
      );
    }

    // Assert session is in LOCKED state
    await this.checkoutStore.assertState(
      dto.checkoutSessionId,
      CheckoutState.LOCKED,
    );

    // Get checkout metadata to get address
    const metadata = await this.checkoutStore.getCheckoutMetadata(
      dto.checkoutSessionId,
    );
    if (!metadata) {
      throw new BadRequestException("Checkout metadata not found");
    }

    // Get address pincode (from stored address or guest address)
    let pincode: string;
    if (metadata.shippingAddressId && metadata.shippingAddressId !== "temp") {
      // Get address from database
      try {
        const addressResult = await this.db
          .select({ pincode: addresses.pincode })
          .from(addresses)
          .where(eq(addresses.id, metadata.shippingAddressId))
          .limit(1);
        const address = addressResult[0];
        if (!address) {
          throw new BadRequestException("Shipping address not found");
        }
        pincode = address.pincode;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.error(
          createErrorContext(
            this.contextService,
            "CheckoutService.selectShipping.addressLookup",
            error,
            {
              checkoutSessionId: dto.checkoutSessionId,
              shippingAddressId: metadata.shippingAddressId,
            },
          ),
          "Failed to fetch shipping address",
        );
        throw new BadRequestException("Shipping address not found");
      }
    } else {
      // Get from guest address stored in metadata
      const extendedMetadata = metadata as ExtendedCheckoutMetadata;
      const guestAddress = extendedMetadata._shippingAddress;
      if (!guestAddress) {
        throw new BadRequestException(
          "Shipping address not set. Please set address first.",
        );
      }
      pincode = guestAddress.pincode;
    }

    // Get cart to calculate weight and total
    const cart = await this.cartsService.getCart(userId, sessionId);
    if (!cart) {
      throw new BadRequestException("Cart not found");
    }

    // Validate shipping method exists and is available
    const shippingMethod = await this.shippingMethodsService.findOne(
      dto.shippingMethodId,
    );

    if (!shippingMethod.isActive) {
      throw new BadRequestException(
        `Shipping method '${shippingMethod.name}' is not active`,
      );
    }

    // Get state from address
    let state: string | undefined;
    if (metadata.shippingAddressId && metadata.shippingAddressId !== "temp") {
      state = await safeAddressStateLookup(
        metadata.shippingAddressId,
        this.db, // Pass injected db instance
        this.logger,
        this.contextService,
        {
          operation: "CheckoutService.selectShipping.getState",
          orderId: dto.checkoutSessionId,
        },
      );
      state = state || undefined;
    } else {
      const extendedMetadata = metadata as ExtendedCheckoutMetadata;
      const guestAddress = extendedMetadata._shippingAddress;
      if (guestAddress) {
        state = guestAddress.state;
      }
    }

    // Check serviceability to get zone
    const serviceability =
      await this.shippingRulesService.checkServiceability(pincode);
    const _zone = serviceability.shippingZone || "zone_c";

    // Check if method is available for this address
    const availableMethods =
      await this.shippingMethodsService.getAvailableMethods({
        pincode,
        state,
        cartTotal: cart.total,
        cartWeight: cart.items.reduce((total, item) => {
          return total + item.quantity * 0.5;
        }, 0),
        isCod: false,
      });

    const isAvailable = availableMethods.some(
      (m) => m.id === dto.shippingMethodId,
    );

    if (!isAvailable) {
      throw new BadRequestException(
        `Shipping method '${shippingMethod.name}' is not available for this address`,
      );
    }

    // Get the selected method details
    const selectedMethod = availableMethods.find(
      (m) => m.id === dto.shippingMethodId,
    );

    if (!selectedMethod) {
      throw new BadRequestException("Selected shipping method not found");
    }

    // Store shipping method and cost in metadata
    const updatedMetadata: ExtendedCheckoutMetadata = {
      ...metadata,
      shippingCost: selectedMethod.cost,
      _shippingMethodId: dto.shippingMethodId,
    };
    await this.checkoutStore.storeCheckoutMetadata(
      dto.checkoutSessionId,
      updatedMetadata,
    );

    return {
      success: true,
      shippingCost: selectedMethod.cost,
      estimatedDays: selectedMethod.estimatedDays,
      codAvailable: selectedMethod.codAvailable,
      checkoutSessionId: dto.checkoutSessionId,
    };
  }

  /**
   * Confirm checkout and create order
   */
  @Trace({ operation: "CheckoutService.confirmCheckout" })
  async confirmCheckout(
    userId: string | null,
    sessionId: string | null,
    dto: CheckoutConfirmDto,
  ) {
    // Get checkout session
    const session = await this.checkoutStore.getSession(dto.checkoutSessionId);
    if (!session) {
      throw new NotFoundException(
        "Checkout session not found. Please start a new checkout.",
      );
    }

    // Check if session has failed
    if (session.state === CheckoutState.FAILED) {
      throw new BadRequestException(
        "Checkout session has failed. Please start a new checkout from your cart.",
      );
    }
    if (session.state === CheckoutState.COMPLETED) {
      throw new BadRequestException(
        "Checkout session has already been completed.",
      );
    }

    // Assert session is in LOCKED state
    // Allow PAYMENT_PENDING as well (in case payment intent was already created)
    if (
      session.state !== CheckoutState.LOCKED &&
      session.state !== CheckoutState.PAYMENT_PENDING
    ) {
      throw new BadRequestException(
        `Checkout session is in invalid state: ${session.state}. Expected LOCKED or PAYMENT_PENDING.`,
      );
    }

    // Get checkout metadata
    const metadata = await this.checkoutStore.getCheckoutMetadata(
      dto.checkoutSessionId,
    );
    if (!metadata) {
      throw new BadRequestException("Checkout metadata not found");
    }

    // Check if shipping method was selected
    // We check _shippingMethodId because shippingCost is initialized to 0,
    // so we can't use !metadata.shippingCost (which would fail for free shipping)
    const extendedMetadata = metadata as ExtendedCheckoutMetadata;
    if (!extendedMetadata._shippingMethodId) {
      throw new BadRequestException("Shipping method not selected");
    }

    // Validate shippingCost is a valid number (can be 0 for free shipping)
    if (
      metadata.shippingCost === undefined ||
      metadata.shippingCost === null ||
      typeof metadata.shippingCost !== "number"
    ) {
      throw new BadRequestException("Shipping cost is invalid");
    }

    if (!metadata.paymentMethod) {
      throw new BadRequestException("Payment method not selected");
    }

    // Get address data (from database or guest address)
    let createOrderDto: CreateOrderDto;
    if (
      extendedMetadata.shippingAddressId &&
      extendedMetadata.shippingAddressId !== "temp"
    ) {
      // Authenticated user - use address ID
      createOrderDto = {
        shippingAddressId: extendedMetadata.shippingAddressId,
        billingAddressId:
          extendedMetadata.billingAddressId ||
          extendedMetadata.shippingAddressId,
        shippingCost: extendedMetadata.shippingCost,
        idempotencyKey: dto.idempotencyKey,
        checkoutSessionId: dto.checkoutSessionId,
      };
    } else {
      // Guest checkout - use address data from metadata
      const guestAddress = extendedMetadata._shippingAddress;
      const guestEmail = extendedMetadata._guestEmail;
      const guestPassword = extendedMetadata._guestPassword; // Password for account creation
      if (!guestAddress) {
        throw new BadRequestException("Shipping address not set");
      }
      createOrderDto = {
        email: guestEmail || guestAddress.email,
        name: guestAddress.name,
        phone: guestAddress.phone,
        address: {
          type: "shipping" as const,
          street: guestAddress.address1,
          city: guestAddress.city,
          state: guestAddress.state,
          pincode: guestAddress.pincode,
          district: guestAddress.city,
          country: guestAddress.country || "India",
        },
        password: guestPassword, // Include password if provided for account creation
        shippingCost: extendedMetadata.shippingCost,
        idempotencyKey: dto.idempotencyKey,
        checkoutSessionId: dto.checkoutSessionId,
      };
    }

    // Check if payment method is COD (use case-insensitive comparison with utility function)
    const isCod = isCodPayment(metadata.paymentMethod);
    this.logger.debug(
      createLogContext(this.contextService, "confirmCheckout", {
        checkoutSessionId: dto.checkoutSessionId,
        paymentMethod: metadata.paymentMethod,
        isCod,
      }),
      "COD detection check",
    );

    // Create order (this will handle payment intent creation for online payments or order creation for COD)
    const paymentIntent = await this.ordersService.create(
      userId,
      createOrderDto,
      sessionId,
    );

    // Handle COD vs online payment flows differently
    // Check if orderId exists (COD orders are created immediately with orderId)
    // This is the definitive check - if orderId exists, it's a COD order
    this.logger.debug(
      createLogContext(this.contextService, "confirmCheckout", {
        checkoutSessionId: dto.checkoutSessionId,
        hasOrderId: !!paymentIntent.orderId,
        orderId: paymentIntent.orderId,
        hasPaymentIntent: !!paymentIntent.paymentIntent,
        paymentIntentId: paymentIntent.paymentIntent?.paymentIntentId,
      }),
      "Payment intent response check",
    );

    if (paymentIntent.orderId) {
      // COD order was created directly - state transitions already handled in OrdersService
      // Release the checkout lock
      try {
        await this.checkoutStore.releaseCheckoutLock(session.cartId);
      } catch (error) {
        // Log but don't fail - lock release failure is non-critical
        this.logger.warn(
          `Failed to release checkout lock for cartId=${session.cartId}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      return {
        orderId: paymentIntent.orderId, // COD orders are created immediately
        paymentIntentId: null, // COD orders don't have payment intents
        redirectUrl: null, // No payment gateway redirect for COD
        checkoutSessionId: dto.checkoutSessionId,
      };
    }

    // Online payment flow - update checkout session with payment intent ID
    if (paymentIntent.paymentIntent) {
      await this.checkoutStore.setPaymentIntent(
        dto.checkoutSessionId,
        paymentIntent.paymentIntent.paymentIntentId,
      );
    }

    // Transition to PAYMENT_PENDING state
    // Note: PaymentsService.createPaymentIntent may have already transitioned the state
    // So we check current state first and only transition if still in LOCKED
    try {
      const currentSession = await this.checkoutStore.getSession(
        dto.checkoutSessionId,
      );
      if (currentSession && currentSession.state === CheckoutState.LOCKED) {
        await this.checkoutStore.transitionState(
          dto.checkoutSessionId,
          CheckoutState.LOCKED,
          CheckoutState.PAYMENT_PENDING,
        );
      } else if (
        currentSession &&
        currentSession.state === CheckoutState.PAYMENT_PENDING
      ) {
        // Already in PAYMENT_PENDING - PaymentsService already transitioned it
        this.logger.debug(
          `Checkout session ${dto.checkoutSessionId} already in PAYMENT_PENDING state`,
        );
      }
    } catch (error) {
      // Log but don't fail - state transition failure shouldn't break the flow
      this.logger.warn(
        `Failed to transition checkout session ${dto.checkoutSessionId} to PAYMENT_PENDING: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Release the checkout lock after payment intent creation
    // Lock is no longer needed as session is tracked by state machine
    // The state machine prevents concurrent operations on the same session
    try {
      await this.checkoutStore.releaseCheckoutLock(session.cartId);
    } catch (error) {
      // Log but don't fail - lock release failure is non-critical
      this.logger.warn(
        `Failed to release checkout lock for cartId=${session.cartId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return {
      orderId: null, // Will be created after payment confirmation
      paymentIntentId: paymentIntent.paymentIntent?.paymentIntentId || null,
      redirectUrl: null, // Payment gateway URL will be generated by payment provider
      checkoutSessionId: dto.checkoutSessionId,
    };
  }
}
