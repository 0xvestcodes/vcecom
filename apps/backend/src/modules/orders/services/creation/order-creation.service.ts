import { Injectable } from "@nestjs/common";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { CreateOrderDto } from "../../dto/create-order.dto";
import { OrderResponseDto } from "../../dto/order-response.dto";
import { PaymentIntentResponseDto } from "../../dto/payment-intent-response.dto";
import { OrderPaymentFinalizationService } from "./order-payment-finalization.service";
import { OrderPaymentIntentFlowService } from "./order-payment-intent-flow.service";

/**
 * Service responsible for order creation operations
 * Handles payment intent creation, COD order creation, and order finalization
 */
@Injectable()
export class OrderCreationService {
  constructor(
    private readonly paymentIntentFlowService: OrderPaymentIntentFlowService,
    private readonly paymentFinalizationService: OrderPaymentFinalizationService,
  ) {}

  /**
   * Create payment intent for checkout
   * Delegates to OrderPaymentIntentFlowService
   */
  @Trace({ operation: "OrderCreationService.create" })
  async create(
    userId: string | null,
    createOrderDto: CreateOrderDto,
    sessionId?: string | null,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentIntentFlowService.createPaymentIntent(
      userId,
      createOrderDto,
      sessionId,
    );
  }

  /**
   * Finalize order from payment confirmation (webhook-driven)
   * Delegates to OrderPaymentFinalizationService
   */
  @Trace({ operation: "OrderCreationService.finalizeOrderFromPayment" })
  async finalizeOrderFromPayment(
    checkoutSessionId: string,
    paymentIntentId: string,
    provider: string = "razorpay",
  ): Promise<OrderResponseDto> {
    return this.paymentFinalizationService.finalizeOrderFromPayment(
      checkoutSessionId,
      paymentIntentId,
      provider,
    );
  }
}
