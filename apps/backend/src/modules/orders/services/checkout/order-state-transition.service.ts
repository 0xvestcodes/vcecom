import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { CheckoutState } from "../../../redis-store/constants/checkout-states";
import { CheckoutStore } from "../../../redis-store/stores/checkout-store";

/**
 * Service responsible for checkout state transitions
 */
@Injectable()
export class OrderStateTransitionService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly checkoutStore: CheckoutStore,
  ) {}

  /**
   * Transition checkout session to PAYMENT_CONFIRMED state
   */
  @Trace({
    operation: "OrderStateTransitionService.transitionToPaymentConfirmed",
  })
  async transitionToPaymentConfirmed(
    checkoutSessionId: string,
    orderId: string,
    fromState: CheckoutState = CheckoutState.LOCKED,
  ): Promise<void> {
    try {
      this.logger.info(
        createLogContext(this.contextService, "transitionToPaymentConfirmed", {
          checkoutSessionId,
          orderId,
          fromState,
          toState: CheckoutState.PAYMENT_CONFIRMED,
        }),
        "Transitioning to PAYMENT_CONFIRMED state",
      );
      await this.checkoutStore.transitionState(
        checkoutSessionId,
        fromState,
        CheckoutState.PAYMENT_CONFIRMED,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToPaymentConfirmed",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to transition to PAYMENT_CONFIRMED state",
      );
      throw error;
    }
  }

  /**
   * Transition checkout session to ORDER_CREATED state
   */
  @Trace({ operation: "OrderStateTransitionService.transitionToOrderCreated" })
  async transitionToOrderCreated(
    checkoutSessionId: string,
    orderId: string,
    fromState: CheckoutState = CheckoutState.PAYMENT_CONFIRMED,
  ): Promise<void> {
    try {
      // Set order ID first
      await this.checkoutStore.setOrder(checkoutSessionId, orderId);

      this.logger.info(
        createLogContext(this.contextService, "transitionToOrderCreated", {
          checkoutSessionId,
          orderId,
          fromState,
          toState: CheckoutState.ORDER_CREATED,
        }),
        "Transitioning to ORDER_CREATED state",
      );
      await this.checkoutStore.transitionState(
        checkoutSessionId,
        fromState,
        CheckoutState.ORDER_CREATED,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToOrderCreated",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to transition to ORDER_CREATED state",
      );
      // Continue - order is created, state transition failure is non-critical
      // But re-throw for COD orders where it's critical
      throw error;
    }
  }

  /**
   * Transition checkout session to COMPLETED state
   */
  @Trace({ operation: "OrderStateTransitionService.transitionToCompleted" })
  async transitionToCompleted(
    checkoutSessionId: string,
    orderId: string,
    fromState: CheckoutState = CheckoutState.ORDER_CREATED,
  ): Promise<void> {
    try {
      this.logger.info(
        createLogContext(this.contextService, "transitionToCompleted", {
          checkoutSessionId,
          orderId,
          fromState,
          toState: CheckoutState.COMPLETED,
        }),
        "Transitioning to COMPLETED state",
      );
      await this.checkoutStore.transitionState(
        checkoutSessionId,
        fromState,
        CheckoutState.COMPLETED,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToCompleted",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to transition to COMPLETED state",
      );
      throw error;
    }
  }

  /**
   * Complete COD order state transitions
   * Transitions: LOCKED → PAYMENT_CONFIRMED → ORDER_CREATED → COMPLETED
   */
  @Trace({
    operation: "OrderStateTransitionService.completeCodOrderTransitions",
  })
  async completeCodOrderTransitions(
    checkoutSessionId: string,
    orderId: string,
  ): Promise<void> {
    // Step 1: Transition to PAYMENT_CONFIRMED (COD = payment confirmed)
    await this.transitionToPaymentConfirmed(
      checkoutSessionId,
      orderId,
      CheckoutState.LOCKED,
    );

    // Step 2: Transition to ORDER_CREATED
    await this.transitionToOrderCreated(
      checkoutSessionId,
      orderId,
      CheckoutState.PAYMENT_CONFIRMED,
    );

    // Step 3: Transition to COMPLETED
    await this.transitionToCompleted(
      checkoutSessionId,
      orderId,
      CheckoutState.ORDER_CREATED,
    );
  }
}
