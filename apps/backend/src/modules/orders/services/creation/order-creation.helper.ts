import { BadRequestException } from "@nestjs/common";
import { CreateOrderDto } from "../../dto/create-order.dto";

/**
 * Helper functions for order creation flow
 * Extracted to improve readability and maintainability
 */

export interface GuestCheckoutData {
  customerId: string;
  userId: string | null;
  shippingAddressId: string;
  billingAddressId: string;
  shippingAddress: { state: string };
  cartId: string;
}

export interface AuthenticatedCheckoutData {
  customerId: string;
  shippingAddressId: string;
  billingAddressId: string;
  shippingAddress: { state: string } | null;
  cartId: string;
}

/**
 * Validate guest checkout requirements
 * @throws BadRequestException if requirements are not met
 */
export function validateGuestCheckoutRequirements(
  createOrderDto: CreateOrderDto,
  sessionId: string | null,
): void {
  if (
    !createOrderDto.email ||
    !createOrderDto.name ||
    !createOrderDto.phone ||
    !createOrderDto.address
  ) {
    throw new BadRequestException(
      "Email, name, phone, and address are required for guest checkout",
    );
  }

  if (!sessionId) {
    throw new BadRequestException("Session ID is required for guest checkout");
  }
}

/**
 * Validate authenticated checkout requirements
 * @throws BadRequestException if requirements are not met
 */
export function validateAuthenticatedCheckoutRequirements(
  createOrderDto: CreateOrderDto,
): void {
  if (!createOrderDto.shippingAddressId || !createOrderDto.billingAddressId) {
    throw new BadRequestException(
      "Shipping and billing address IDs are required for authenticated checkout",
    );
  }
}

/**
 * Determine if checkout is guest or authenticated
 */
export function isGuestCheckout(
  userId: string | null,
  createOrderDto: CreateOrderDto,
): boolean {
  return !userId || !!createOrderDto.email;
}
