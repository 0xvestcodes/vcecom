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
