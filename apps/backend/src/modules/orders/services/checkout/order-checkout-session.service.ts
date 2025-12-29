import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { CheckoutState } from "../../../redis-store/constants/checkout-states";
import { CheckoutMetadata } from "../../../redis-store/dto/checkout-metadata.dto";
import { CheckoutStore } from "../../../redis-store/stores/checkout-store";

/**
 * Service responsible for managing checkout sessions during order creation
 * Handles session creation, state transitions, locks, and metadata operations
 */
@Injectable()
export class OrderCheckoutSessionService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly checkoutStore: CheckoutStore,
  ) {}

  /**
   * Get or create checkout session for a cart
   * If sessionId is provided, validates and returns existing session
   * Otherwise, creates new session and acquires lock
   */
  @Trace({ operation: "OrderCheckoutSessionService.getOrCreateSession" })
  async getOrCreateSession(
    cartId: string,
    existingSessionId?: string | null,
  ): Promise<{
    sessionId: string;
    lockAcquired: boolean;
    isExisting: boolean;
  }> {
    if (existingSessionId) {
      // Validate existing session
      const session = await this.checkoutStore.getSession(existingSessionId);
      if (!session) {
        throw new BadRequestException(
          `Checkout session ${existingSessionId} not found`,
        );
      }
      if (session.cartId !== cartId) {
        throw new BadRequestException(
          `Checkout session cart ID mismatch: expected ${cartId}, got ${session.cartId}`,
        );
      }
      return {
        sessionId: existingSessionId,
        lockAcquired: false, // Lock already held by CheckoutService
        isExisting: true,
      };
    }

    // Create new session
    let sessionId: string;
    try {
      const sessionResult = await this.checkoutStore.createSession(cartId);
      sessionId = sessionResult.sessionId;
    } catch (error) {
      // Session creation failure is non-fatal
      // Order creation can proceed without state machine tracking
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "createCheckoutSession",
          error,
          { cartId },
        ),
        "Failed to create checkout session, proceeding without state machine",
      );
      throw error;
    }

    // Acquire checkout lock
    const lockAcquired = await this.checkoutStore.acquireCheckoutLock(cartId);
    if (!lockAcquired) {
      // Another checkout is in progress - mark session as failed if it exists
      if (sessionId) {
        try {
          await this.checkoutStore.failSession(sessionId);
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "failSessionOnLockFailure",
              error,
              { sessionId },
            ),
            "Failed to fail checkout session",
          );
        }
      }
      throw new ConflictException("Cart is already being checked out");
    }

    // Transition session to LOCKED state
    try {
      await this.checkoutStore.transitionState(
        sessionId,
        CheckoutState.CREATED,
        CheckoutState.LOCKED,
      );
    } catch (error) {
      // State transition failure is non-fatal - lock is already held
      this.logger.error(
        createErrorContext(this.contextService, "transitionToLocked", error, {
          sessionId,
        }),
        "State transition to LOCKED failed, but lock is acquired",
      );
    }

    return {
      sessionId,
      lockAcquired: true,
      isExisting: false,
    };
  }

  /**
   * Get checkout session and validate state
   */
  @Trace({ operation: "OrderCheckoutSessionService.getSession" })
  async getSession(
    sessionId: string,
    expectedState?: CheckoutState,
  ): Promise<{
    sessionId: string;
    cartId: string;
    state: CheckoutState;
  }> {
    const session = await this.checkoutStore.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Checkout session ${sessionId} not found`);
    }

    if (expectedState && session.state !== expectedState) {
      throw new ConflictException(
        `Checkout session is in state ${session.state}, expected ${expectedState}`,
      );
    }

    return {
      sessionId,
      cartId: session.cartId,
      state: session.state,
    };
  }

  /**
   * Get checkout metadata
   */
  @Trace({ operation: "OrderCheckoutSessionService.getMetadata" })
  async getMetadata(sessionId: string): Promise<CheckoutMetadata> {
    const metadata = await this.checkoutStore.getCheckoutMetadata(sessionId);
    if (!metadata) {
      throw new NotFoundException(
        `Checkout metadata not found for session ${sessionId}`,
      );
    }
    return metadata;
  }

  /**
   * Store checkout metadata
   */
  @Trace({ operation: "OrderCheckoutSessionService.storeMetadata" })
  async storeMetadata(
    sessionId: string,
    metadata: CheckoutMetadata,
  ): Promise<void> {
    try {
      await this.checkoutStore.storeCheckoutMetadata(sessionId, metadata);
      this.logger.debug(
        createLogContext(this.contextService, "storeCheckoutMetadata", {
          sessionId,
        }),
        "Stored checkout metadata",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "storeCheckoutMetadata",
          error,
          { sessionId },
        ),
        "Failed to store checkout metadata",
      );
      throw new ConflictException(
        "Failed to store checkout metadata - cannot proceed with order creation",
      );
    }
  }

  /**
   * Transition checkout session state
   */
  @Trace({ operation: "OrderCheckoutSessionService.transitionState" })
  async transitionState(
    sessionId: string,
    fromState: CheckoutState,
    toState: CheckoutState,
  ): Promise<void> {
    try {
      await this.checkoutStore.transitionState(sessionId, fromState, toState);
      this.logger.debug(
        createLogContext(this.contextService, "transitionState", {
          sessionId,
          fromState,
          toState,
        }),
        "Checkout session state transitioned",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "transitionState", error, {
          sessionId,
          fromState,
          toState,
        }),
        "Failed to transition checkout session state",
      );
      throw error;
    }
  }

  /**
   * Assert checkout session is in expected state
   */
  @Trace({ operation: "OrderCheckoutSessionService.assertState" })
  async assertState(
    sessionId: string,
    expectedState: CheckoutState,
  ): Promise<void> {
    try {
      await this.checkoutStore.assertState(sessionId, expectedState);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "assertState", error, {
          sessionId,
          expectedState,
        }),
        "Checkout session state assertion failed",
      );
      throw error;
    }
  }

  /**
   * Release checkout lock
   */
  @Trace({ operation: "OrderCheckoutSessionService.releaseLock" })
  async releaseLock(cartId: string): Promise<void> {
    try {
      await this.checkoutStore.releaseCheckoutLock(cartId);
    } catch (error) {
      // Log but don't throw - lock release failure shouldn't break order creation
      this.logger.error(
        createErrorContext(this.contextService, "releaseCheckoutLock", error, {
          cartId,
        }),
        "Failed to release checkout lock",
      );
    }
  }

  /**
   * Fail checkout session and release lock
   */
  @Trace({ operation: "OrderCheckoutSessionService.failSession" })
  async failSession(sessionId: string): Promise<void> {
    try {
      await this.checkoutStore.failSession(sessionId);
    } catch (error) {
      // Log but don't throw - failure handling should be best-effort
      this.logger.error(
        createErrorContext(this.contextService, "failSession", error, {
          sessionId,
        }),
        "Failed to fail checkout session",
      );
    }
  }

  /**
   * Set order ID in checkout session
   */
  @Trace({ operation: "OrderCheckoutSessionService.setOrder" })
  async setOrder(sessionId: string, orderId: string): Promise<void> {
    try {
      await this.checkoutStore.setOrder(sessionId, orderId);
      this.logger.debug(
        createLogContext(this.contextService, "setOrder", {
          sessionId,
          orderId,
        }),
        "Set order ID in checkout session",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "setOrder", error, {
          sessionId,
          orderId,
        }),
        "Failed to set order ID in checkout session",
      );
      throw error;
    }
  }

  /**
   * Get order ID by payment intent (for idempotency)
   */
  @Trace({ operation: "OrderCheckoutSessionService.getOrderByPaymentIntent" })
  async getOrderByPaymentIntent(
    provider: string,
    paymentIntentId: string,
  ): Promise<string | null> {
    return this.checkoutStore.getOrderByPaymentIntent(
      provider,
      paymentIntentId,
    );
  }

  /**
   * Create order mapping from payment intent (for idempotency)
   */
  @Trace({ operation: "OrderCheckoutSessionService.createOrderFromPayment" })
  async createOrderFromPayment(
    provider: string,
    paymentIntentId: string,
    orderId: string,
  ): Promise<void> {
    try {
      await this.checkoutStore.createOrderFromPayment(
        provider,
        paymentIntentId,
        orderId,
      );
      this.logger.debug(
        createLogContext(this.contextService, "createOrderFromPayment", {
          provider,
          paymentIntentId,
          orderId,
        }),
        "Created order mapping from payment intent",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "createOrderFromPayment",
          error,
          { provider, paymentIntentId, orderId },
        ),
        "Failed to create order mapping from payment intent",
      );
      throw error;
    }
  }
}
