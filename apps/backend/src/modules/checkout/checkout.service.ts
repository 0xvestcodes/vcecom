import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { addresses, and, cartItems, eq, inArray } from "@vcecom/db";
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
import { CheckoutLockStore } from "../redis-store/stores/checkout-lock-store";
import { CheckoutStore } from "../redis-store/stores/checkout-store";
import { InventoryStore } from "../redis-store/stores/inventory-store";
import { StaleMarkerStore } from "../redis-store/stores/stale-marker-store";
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
    private readonly inventoryStore: InventoryStore,
    private readonly checkoutLockStore: CheckoutLockStore,
    private readonly staleMarkerStore: StaleMarkerStore,
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

    // ATOMIC REACQUISITION for all items
    // This validates availability, clears old reservations, creates new reservations with checkout TTL, and sets checkout lock
    // Convert enriched cart items to format expected by reacquireAllCartItems
    const itemsForReacquisition = cart.items.map((item) => ({
      type: item.type,
      variantId: item.variantId,
      quantity: item.quantity,
      bundleVariantBreakdown:
        item.type === "bundle" && "bundleVariantBreakdown" in item
          ? item.bundleVariantBreakdown?.map((b) => ({
              variantId: b.variantId,
              quantity: b.quantity,
            }))
          : undefined,
    }));

    this.logger.info(
      createLogContext(this.contextService, "startCheckout.preReacquisition", {
        cartId: cart.id,
        itemCount: cart.items.length,
        items: itemsForReacquisition.map(i => ({
          type: i.type,
          variantId: i.variantId,
          quantity: i.quantity,
          hasBundleBreakdown: !!i.bundleVariantBreakdown
        }))
      }),
      `Starting inventory reacquisition for cart ${cart.id} with ${cart.items.length} items`
    );

    const reacquisitionResults = await this.reacquireAllCartItems(
      cart.id,
      itemsForReacquisition,
    );

    this.logger.info(
      createLogContext(this.contextService, "startCheckout.postReacquisition", {
        cartId: cart.id,
        allValid: reacquisitionResults.allValid,
        failureCount: reacquisitionResults.failures.length,
        failures: reacquisitionResults.failures
      }),
      `Reacquisition completed: allValid=${reacquisitionResults.allValid}, failures=${reacquisitionResults.failures.length}`
    );

    if (!reacquisitionResults.allValid) {
      // Some items failed - adjust cart quantities and return errors
      await this.adjustCartForFailedReacquisition(
        cart.id,
        reacquisitionResults.failures,
      );

      // Clear checkout lock (reacquisition script sets it, but we need to clear on failure)
      await this.checkoutLockStore.clearCheckoutLock(cart.id);

      // Get updated cart to return to user
      const adjustedCart = await this.cartsService.getCart(userId, sessionId);

      throw new BadRequestException({
        message: "Some items are no longer available",
        failures: reacquisitionResults.failures,
        adjustedCart,
      });
    }

    // Mark all items as REACQUIRED in DB
    await this.markCartItemsReacquired(cart.id, itemsForReacquisition);

    // Checkout lock is already set by reacquisition script
    // Verify lock exists (should always be true after successful reacquisition)
    const lockExists = await this.checkoutLockStore.hasCheckoutLock(cart.id);
    if (!lockExists) {
      this.logger.warn(
        `Checkout lock not found after reacquisition for cartId=${cart.id}, this should not happen`,
      );
      // Set lock manually as fallback
      await this.checkoutLockStore.setCheckoutLock(cart.id);
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
   * Atomically reacquire inventory for all cart items
   * Returns success status and any failures with available quantities
   */
  private async reacquireAllCartItems(
    cartId: string,
    items: Array<{
      type: "variant" | "bundle";
      variantId: string; // Changed from productVariantId
      quantity: number;
      bundleVariantBreakdown?: Array<{ variantId: string; quantity: number }>;
    }>,
  ): Promise<{
    allValid: boolean;
    failures: Array<{
      variantId: string;
      requested: number;
      available: number;
    }>;
  }> {
    const failures: Array<{
      variantId: string;
      requested: number;
      available: number;
    }> = [];

    for (const item of items) {
      // Handle both variant and bundle items
      if (item.type === "bundle" && item.bundleVariantBreakdown) {
        // Bundle item - reacquire each variant in breakdown
        for (const variantBreakdown of item.bundleVariantBreakdown) {
          const result = await this.inventoryStore.reacquireInventoryAtomic(
            cartId,
            variantBreakdown.variantId,
            variantBreakdown.quantity,
          );

          if (!result.valid) {
            failures.push({
              variantId: variantBreakdown.variantId,
              requested: variantBreakdown.quantity,
              available: result.available || 0,
            });
          }
        }
      } else {
        // Variant item - atomic reacquisition
        const result = await this.inventoryStore.reacquireInventoryAtomic(
          cartId,
          item.variantId, // Use variantId instead of productVariantId
          item.quantity,
        );

        if (!result.valid) {
          failures.push({
            variantId: item.variantId, // Use variantId instead of productVariantId
            requested: item.quantity,
            available: result.available || 0,
          });
        }
      }
    }

    return {
      allValid: failures.length === 0,
      failures,
    };
  }

  /**
   * Adjust cart quantities for failed reacquisitions
   * Updates cart items to match available inventory or removes them if unavailable
   */
  private async adjustCartForFailedReacquisition(
    cartId: string,
    failures: Array<{ variantId: string; requested: number; available: number }>,
  ): Promise<void> {

    for (const failure of failures) {
      // Find cart item for this variant
      const [item] = await this.db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, cartId),
            eq(cartItems.productVariantId, failure.variantId),
          ),
        )
        .limit(1);

      if (!item) {
        continue; // Item not found, skip
      }

      if (failure.available > 0) {
        // Update quantity to available amount
        await this.db
          .update(cartItems)
          .set({
            quantity: failure.available,
            state: "fresh", // Reset to fresh after adjustment
            staleMarkedAt: null,
          })
          .where(eq(cartItems.id, item.id));

        // Clear stale marker
        await this.staleMarkerStore.clearStaleMarker(
          cartId,
          failure.variantId,
        );
      } else {
        // No inventory available - remove item from cart
        await this.db.delete(cartItems).where(eq(cartItems.id, item.id));
      }
    }

    // Recalculate cart totals after adjustments
    // Note: getCartById already recalculates totals internally, but we need to ensure
    // the cart is properly refreshed. For now, we'll let the next getCart call handle it.
  }

  /**
   * Mark cart items as REACQUIRED in database
   */
  private async markCartItemsReacquired(
    cartId: string,
    items: Array<{
      type: "variant" | "bundle";
      variantId: string; // Changed from productVariantId
      bundleVariantBreakdown?: Array<{ variantId: string; quantity: number }>;
    }>,
  ): Promise<void> {

    // Collect all variant IDs (from both variant items and bundle breakdowns)
    const variantIds: string[] = [];
    for (const item of items) {
      if (item.type === "bundle" && item.bundleVariantBreakdown) {
        for (const breakdown of item.bundleVariantBreakdown) {
          variantIds.push(breakdown.variantId);
        }
      } else {
        variantIds.push(item.variantId); // Use variantId instead of productVariantId
      }
    }

    if (variantIds.length === 0) {
      return;
    }

    // Update all matching cart items to REACQUIRED state
    await this.db
      .update(cartItems)
      .set({
        state: "reacquired",
        reacquiredAt: new Date(),
      })
      .where(
        and(
          eq(cartItems.cartId, cartId),
          inArray(cartItems.productVariantId, variantIds),
        ),
      );

    // Clear stale markers for all reacquired items
    for (const variantId of variantIds) {
      await this.staleMarkerStore.clearStaleMarker(cartId, variantId);
    }
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
      // Clear the checkout lock (reservations already committed in order creation)
      try {
        await this.checkoutLockStore.clearCheckoutLock(session.cartId);
      } catch (error) {
        // Log but don't fail - lock release failure is non-critical
        this.logger.warn(
          `Failed to clear checkout lock for cartId=${session.cartId}: ${error instanceof Error ? error.message : "Unknown error"}`,
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

    // Keep checkout lock active during payment - will be cleared after order finalization
    // The lock prevents heartbeat/cleanup from interfering during checkout window
    // It will be cleared in finalizeOrderFromPayment after atomic commit

    return {
      orderId: null, // Will be created after payment confirmation
      paymentIntentId: paymentIntent.paymentIntent?.paymentIntentId || null,
      redirectUrl: null, // Payment gateway URL will be generated by payment provider
      checkoutSessionId: dto.checkoutSessionId,
    };
  }
}
