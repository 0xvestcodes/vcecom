import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { addresses, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { Trace } from "../../../../common/tracing/trace.decorator";
import type { Database } from "../../../../modules/database/db";
import { CartsService } from "../../../carts/carts.service";
import { AddressesService } from "../../../customers/addresses.service";
import { CustomersService } from "../../../customers/customers.service";
import { DB_TOKEN } from "../../../database/database.module";
import { CheckoutStore } from "../../../redis-store/stores/checkout-store";
import { CreateOrderDto } from "../../dto/create-order.dto";
import {
  isGuestCheckout,
  validateAuthenticatedCheckoutRequirements,
  validateGuestCheckoutRequirements,
} from "../creation/order-creation.helper";
import { OrderValidationService } from "../validation/order-validation.service";

/**
 * Service responsible for orchestrating checkout flow
 * Handles guest vs authenticated checkout, customer creation, and address setup
 */
@Injectable()
export class OrderCheckoutOrchestrationService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
    private readonly customersService: CustomersService,
    private readonly addressesService: AddressesService,
    private readonly cartsService: CartsService,
    private readonly validationService: OrderValidationService,
    private readonly checkoutStore: CheckoutStore,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Orchestrate checkout setup (customer, addresses, cart)
   * Returns customer ID, address IDs, cart ID, and shipping address
   */
  @Trace({ operation: "OrderCheckoutOrchestrationService.orchestrateCheckout" })
  async orchestrateCheckout(
    userId: string | null,
    createOrderDto: CreateOrderDto,
    sessionId?: string | null,
  ): Promise<{
    customerId: string;
    shippingAddressId: string;
    billingAddressId: string;
    cartId: string;
    actualUserId: string | null;
    shippingAddress: { state: string };
  }> {
    // If checkoutSessionId is provided, retrieve metadata and populate DTO
    if (createOrderDto.checkoutSessionId) {
      // First, verify the checkout session exists
      const checkoutSession = await this.checkoutStore.getSession(
        createOrderDto.checkoutSessionId,
      );

      if (!checkoutSession) {
        throw new BadRequestException(
          "Checkout session expired or invalid. Please start a new checkout from your cart.",
        );
      }

      // Then, retrieve metadata
      const metadata = await this.checkoutStore.getCheckoutMetadata(
        createOrderDto.checkoutSessionId,
      );

      if (!metadata) {
        // Log debug information to help diagnose Redis issues
        this._logger.warn(
          {
            checkoutSessionId: createOrderDto.checkoutSessionId,
            sessionExists: true,
            sessionState: checkoutSession.state,
            sessionCartId: checkoutSession.cartId,
          },
          "Checkout session exists but metadata is missing - possible Redis issue or session corruption",
        );

        throw new BadRequestException(
          "Checkout session is missing required data. Please restart checkout from your cart.",
        );
      }

      this._logger.debug(
        {
          checkoutSessionId: createOrderDto.checkoutSessionId,
          hasShippingAddressId: !!metadata.shippingAddressId,
          hasBillingAddressId: !!metadata.billingAddressId,
          hasShippingAddress: "_shippingAddress" in metadata,
          metadataKeys: Object.keys(metadata),
        },
        "Retrieved checkout metadata",
      );

      // If metadata has address IDs, use them (authenticated checkout)
      if (metadata.shippingAddressId && metadata.billingAddressId) {
        createOrderDto.shippingAddressId = metadata.shippingAddressId;
        createOrderDto.billingAddressId = metadata.billingAddressId;
      }
      // If metadata has guest address data, populate DTO (guest checkout)
      else if (
        metadata &&
        typeof metadata === "object" &&
        "_shippingAddress" in metadata
      ) {
        const guestAddress = (metadata as { _shippingAddress?: unknown })
          ._shippingAddress;
        if (
          guestAddress &&
          typeof guestAddress === "object" &&
          "email" in guestAddress &&
          "name" in guestAddress &&
          "phone" in guestAddress &&
          "address1" in guestAddress &&
          "city" in guestAddress &&
          "state" in guestAddress &&
          "pincode" in guestAddress
        ) {
          const addr = guestAddress as {
            email: string;
            name: string;
            phone: string;
            address1: string;
            address2?: string;
            city: string;
            state: string;
            pincode: string;
            country?: string;
          };
          createOrderDto.email = addr.email;
          createOrderDto.name = addr.name;
          createOrderDto.phone = addr.phone;
          // Combine address1 and address2 into street (CreateAddressDto uses 'street' field)
          const streetAddress = addr.address2
            ? `${addr.address1}, ${addr.address2}`
            : addr.address1;
          createOrderDto.address = {
            street: streetAddress,
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
            country: addr.country || "India",
          };

          // Get password from metadata if available
          if (
            metadata &&
            typeof metadata === "object" &&
            "_guestPassword" in metadata
          ) {
            const password = (metadata as { _guestPassword?: string })
              ._guestPassword;
            if (password) {
              createOrderDto.password = password;
            }
          }

          this._logger.debug(
            {
              checkoutSessionId: createOrderDto.checkoutSessionId,
              email: createOrderDto.email,
              name: createOrderDto.name,
              phone: createOrderDto.phone,
              hasAddress: !!createOrderDto.address,
            },
            "Populated DTO from checkout metadata for guest checkout",
          );
        } else {
          this._logger.warn(
            {
              checkoutSessionId: createOrderDto.checkoutSessionId,
              guestAddressType: typeof guestAddress,
              guestAddressKeys:
                guestAddress && typeof guestAddress === "object"
                  ? Object.keys(guestAddress)
                  : [],
            },
            "Guest address data in metadata is missing required fields",
          );
        }
      } else {
        this._logger.warn(
          {
            checkoutSessionId: createOrderDto.checkoutSessionId,
            hasShippingAddressId: !!metadata.shippingAddressId,
            hasBillingAddressId: !!metadata.billingAddressId,
            hasShippingAddress: "_shippingAddress" in metadata,
          },
          "Metadata does not contain address IDs or guest address data",
        );
      }
    }

    // Determine if guest checkout or authenticated checkout
    const checkoutIsGuest = isGuestCheckout(userId, createOrderDto);

    if (checkoutIsGuest) {
      return this.handleGuestCheckout(createOrderDto, sessionId);
    } else {
      return this.handleAuthenticatedCheckout(userId, createOrderDto);
    }
  }

  /**
   * Handle guest checkout flow
   */
  private async handleGuestCheckout(
    createOrderDto: CreateOrderDto,
    sessionId: string | null | undefined,
  ): Promise<{
    customerId: string;
    shippingAddressId: string;
    billingAddressId: string;
    cartId: string;
    actualUserId: string | null;
    shippingAddress: { state: string };
  }> {
    // Guest checkout flow
    // sessionId is guaranteed to be non-null after validation
    validateGuestCheckoutRequirements(createOrderDto, sessionId ?? null);

    // If checkoutSessionId is provided, use metadata to get/create customer and addresses
    if (createOrderDto.checkoutSessionId) {
      const metadata = await this.checkoutStore.getCheckoutMetadata(
        createOrderDto.checkoutSessionId,
      );

      if (!metadata) {
        throw new BadRequestException(
          `Checkout metadata not found for session ${createOrderDto.checkoutSessionId}`,
        );
      }

      // Get checkout session to retrieve cartId
      const checkoutSession = await this.checkoutStore.getSession(
        createOrderDto.checkoutSessionId,
      );
      if (!checkoutSession) {
        throw new BadRequestException(
          `Checkout session not found: ${createOrderDto.checkoutSessionId}`,
        );
      }

      // If customerId exists in metadata and is not "temp", use it (customer already created)
      if (
        metadata.customerId &&
        metadata.customerId !== "temp" &&
        metadata.shippingAddressId &&
        metadata.shippingAddressId !== "temp" &&
        metadata.billingAddressId &&
        metadata.billingAddressId !== "temp"
      ) {
        // Get cart by cartId from checkout session
        const cart = await this.cartsService.getCartById(
          checkoutSession.cartId,
        );
        if (!cart || !cart.items || cart.items.length === 0) {
          throw new BadRequestException("Cart is empty");
        }

        // Fetch shipping address for state calculation
        const [fetchedShippingAddress] = await this.db
          .select()
          .from(addresses)
          .where(eq(addresses.id, metadata.shippingAddressId))
          .limit(1);

        if (!fetchedShippingAddress) {
          throw new BadRequestException("Shipping address not found");
        }

        return {
          customerId: metadata.customerId,
          shippingAddressId: metadata.shippingAddressId,
          billingAddressId: metadata.billingAddressId,
          cartId: cart.id,
          actualUserId: metadata.userId,
          shippingAddress: fetchedShippingAddress,
        };
      }

      // If customerId doesn't exist but _shippingAddress does, create customer and addresses
      if (
        metadata &&
        typeof metadata === "object" &&
        "_shippingAddress" in metadata
      ) {
        const guestAddress = (metadata as { _shippingAddress?: unknown })
          ._shippingAddress;
        if (
          guestAddress &&
          typeof guestAddress === "object" &&
          "email" in guestAddress &&
          "name" in guestAddress &&
          "phone" in guestAddress &&
          "address1" in guestAddress &&
          "city" in guestAddress &&
          "state" in guestAddress &&
          "pincode" in guestAddress
        ) {
          const addr = guestAddress as {
            email: string;
            name: string;
            phone: string;
            address1: string;
            address2?: string;
            city: string;
            state: string;
            pincode: string;
            country?: string;
          };

          // Get password from metadata if available
          const password =
            metadata &&
            typeof metadata === "object" &&
            "_guestPassword" in metadata
              ? (metadata as { _guestPassword?: string })._guestPassword || null
              : null;

          // Create or get guest customer
          const customer = await this.customersService.createGuestCustomer(
            addr.email,
            addr.name,
            addr.phone,
            password,
          );
          const customerId = customer.id;
          const actualUserId = customer.userId;

          // Create addresses for guest customer
          const streetAddress = addr.address2
            ? `${addr.address1}, ${addr.address2}`
            : addr.address1;
          const guestShippingAddress =
            await this.addressesService.createByCustomerId(customerId, {
              street: streetAddress,
              city: addr.city,
              state: addr.state,
              pincode: addr.pincode,
              country: addr.country || "India",
              type: "shipping",
            });
          const shippingAddressId = guestShippingAddress.id;

          // Create billing address (use same address if not specified separately)
          const billingAddress = await this.addressesService.createByCustomerId(
            customerId,
            {
              street: streetAddress,
              city: addr.city,
              state: addr.state,
              pincode: addr.pincode,
              country: addr.country || "India",
              type: "billing",
            },
          );
          const billingAddressId = billingAddress.id;

          // Get cart by cartId from checkout session
          const cart = await this.cartsService.getCartById(
            checkoutSession.cartId,
          );
          if (!cart || !cart.items || cart.items.length === 0) {
            throw new BadRequestException("Cart is empty");
          }
          const cartId = cart.id;

          return {
            customerId,
            shippingAddressId,
            billingAddressId,
            cartId,
            actualUserId,
            shippingAddress: guestShippingAddress,
          };
        }
      }

      throw new BadRequestException(
        "Checkout metadata does not contain required customer or address information",
      );
    }

    // Extract validated values (guaranteed to exist after validation)
    const guestEmail = createOrderDto.email;
    const guestName = createOrderDto.name;
    const guestPhone = createOrderDto.phone;
    const guestAddress = createOrderDto.address;

    if (!guestEmail || !guestName || !guestPhone || !guestAddress) {
      throw new BadRequestException("Missing required guest checkout fields");
    }

    if (!sessionId) {
      throw new BadRequestException(
        "Session ID is required for guest checkout",
      );
    }

    // Create or get guest customer
    const customer = await this.customersService.createGuestCustomer(
      guestEmail,
      guestName,
      guestPhone,
      createOrderDto.password || null,
    );
    const customerId = customer.id;
    const actualUserId = customer.userId;

    // Create addresses for guest customer
    const guestShippingAddress = await this.addressesService.createByCustomerId(
      customerId,
      {
        ...guestAddress,
        type: "shipping",
      },
    );
    const shippingAddressId = guestShippingAddress.id;

    // Create billing address (use same address if not specified separately)
    const billingAddress = await this.addressesService.createByCustomerId(
      customerId,
      {
        ...guestAddress,
        type: "billing",
      },
    );
    const billingAddressId = billingAddress.id;

    // Get guest cart by sessionId
    const cart = await this.cartsService.getCart(null, sessionId);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }
    const cartId = cart.id;

    return {
      customerId,
      shippingAddressId,
      billingAddressId,
      cartId,
      actualUserId,
      shippingAddress: guestShippingAddress,
    };
  }

  /**
   * Handle authenticated checkout flow
   */
  private async handleAuthenticatedCheckout(
    userId: string | null,
    createOrderDto: CreateOrderDto,
  ): Promise<{
    customerId: string;
    shippingAddressId: string;
    billingAddressId: string;
    cartId: string;
    actualUserId: string | null;
    shippingAddress: { state: string };
  }> {
    // Authenticated checkout flow
    // userId is guaranteed to be non-null for authenticated checkout
    if (!userId) {
      throw new BadRequestException(
        "User ID is required for authenticated checkout",
      );
    }
    const customerId = await this.validationService.getCustomerId(userId);
    validateAuthenticatedCheckoutRequirements(createOrderDto);

    // Extract validated address IDs (guaranteed to exist due to validation)
    const shippingAddrId = createOrderDto.shippingAddressId;
    const billingAddrId = createOrderDto.billingAddressId;

    if (!shippingAddrId || !billingAddrId) {
      throw new BadRequestException(
        "Shipping and billing address IDs are required",
      );
    }

    await this.validationService.getAddresses(
      customerId,
      shippingAddrId,
      billingAddrId,
    );
    const shippingAddressId = shippingAddrId;
    const billingAddressId = billingAddrId;

    // Fetch shipping address for state calculation
    const [fetchedShippingAddress] = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.id, shippingAddressId))
      .limit(1);
    if (!fetchedShippingAddress) {
      throw new BadRequestException("Shipping address not found");
    }

    // Get customer cart after address validation
    const cart = await this.cartsService.getCart(userId, null);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }
    const cartId = cart.id;

    return {
      customerId,
      shippingAddressId,
      billingAddressId,
      cartId,
      actualUserId: userId,
      shippingAddress: fetchedShippingAddress,
    };
  }
}
