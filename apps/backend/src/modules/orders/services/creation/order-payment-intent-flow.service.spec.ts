// Mock OrderPaymentIntentService BEFORE importing to break circular dependency
jest.mock('../payment/order-payment-intent.service', () => ({
  OrderPaymentIntentService: jest.fn().mockImplementation(() => ({
    createPaymentIntent: jest.fn(),
  })),
}));

// Mock PaymentsService to break circular dependency
jest.mock('../../../payments/payments.service', () => ({
  PaymentsService: jest.fn().mockImplementation(() => ({})),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ContextService } from '../../../../common/logging/context.service';
import { OrderPaymentIntentFlowService } from './order-payment-intent-flow.service';
import { OrderCheckoutOrchestrationService } from '../checkout/order-checkout-orchestration.service';
import { OrderCartDataService } from '../cart/order-cart-data.service';
import { OrderCheckoutSessionService } from '../checkout/order-checkout-session.service';
import { OrderCartProcessingService } from '../cart/order-cart-processing.service';
import { OrderCalculationService } from '../calculation/order-calculation.service';
import { OrderPricingEngineService } from '../pricing/order-pricing-engine.service';
import { OrderDiscountEngineService } from '../discount/order-discount-engine.service';
import { OrderMetadataService } from '../checkout/order-metadata.service';
import { OrderPaymentIntentService } from '../payment/order-payment-intent.service';
import { OrderCodFlowService } from './order-cod-flow.service';
import { OrderValidationService } from '../validation/order-validation.service';
import { CheckoutStore } from '../../../redis-store/stores/checkout-store';
import { DB_TOKEN } from '../../../database/database.module';
import { CreateOrderDto } from '../../dto/create-order.dto';
import { createMockCart } from '../../../../test/fixtures/order.fixtures';

describe('OrderPaymentIntentFlowService', () => {
  let service: OrderPaymentIntentFlowService;
  let checkoutOrchestrationService: jest.Mocked<OrderCheckoutOrchestrationService>;
  let cartDataService: jest.Mocked<OrderCartDataService>;
  let checkoutSessionService: jest.Mocked<OrderCheckoutSessionService>;
  let codFlowService: jest.Mocked<OrderCodFlowService>;
  let paymentIntentService: jest.Mocked<OrderPaymentIntentService>;
  let checkoutStore: jest.Mocked<CheckoutStore>;
  let metadataService: jest.Mocked<OrderMetadataService>;
  let cartProcessingService: jest.Mocked<OrderCartProcessingService>;
  let dbSelectCallCount: number;

  beforeEach(async () => {
    const mockCheckoutOrchestrationService = {
      orchestrateCheckout: jest.fn().mockResolvedValue({
        customerId: 'customer_123',
        shippingAddressId: 'address_123',
        billingAddressId: 'address_456',
        cartId: 'cart_123',
        actualUserId: 'user_123',
        shippingAddress: {
          id: 'address_123',
          state: 'Karnataka',
        },
        billingAddress: {
          id: 'address_456',
          state: 'Karnataka',
        },
      }),
    };

    const mockCart = createMockCart();
    const mockCartDataService = {
      getCartData: jest.fn(),
      getCartForOrder: jest.fn().mockResolvedValue(mockCart),
    };

    const mockCheckoutSessionService = {
      createCheckoutSession: jest.fn(),
      updateCheckoutState: jest.fn(),
      getOrCreateSession: jest.fn().mockResolvedValue({
        sessionId: 'checkout_session_123',
        cartId: 'cart_123',
        state: 'PENDING',
      }),
      failSession: jest.fn().mockResolvedValue(undefined),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };

    const mockCodFlowService = {
      createCodOrder: jest.fn(),
    };

    const mockPaymentIntentService = {
      createPaymentIntent: jest.fn(),
    };

    const mockCheckoutStore = {
      get: jest.fn(),
      set: jest.fn(),
      getCheckoutMetadata: jest.fn().mockResolvedValue(null),
      storeCheckoutMetadata: jest.fn().mockResolvedValue(undefined),
      getSession: jest.fn(),
      createOrGetPaymentIntent: jest.fn(),
    };

    // Mock db.select to handle multiple calls (variantProductMap and productDetails)
    dbSelectCallCount = 0; // Reset before each test
    const mockDb = {
      select: jest.fn().mockImplementation(() => {
        dbSelectCallCount++;
        // First call: variantProductMap
        if (dbSelectCallCount === 1) {
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([
                { variantId: 'variant_1', productId: 'product_1' },
                { variantId: 'variant_2', productId: 'product_2' },
              ]),
            }),
          };
        }
        // Second call: productDetails
        return {
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { productId: 'product_1', categoryId: 'cat_1' },
              { productId: 'product_2', categoryId: 'cat_2' },
            ]),
          }),
        };
      }),
    };

    const mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    };

    const mockContextService = {
      getRequestId: jest.fn().mockReturnValue('test-request-id'),
      getTraceId: jest.fn().mockReturnValue('test-trace-id'),
      getSpanId: jest.fn().mockReturnValue('test-span-id'),
      get: jest.fn().mockReturnValue({}),
      set: jest.fn(),
      clear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderPaymentIntentFlowService,
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
        {
          provide: ContextService,
          useValue: mockContextService,
        },
        {
          provide: OrderCheckoutOrchestrationService,
          useValue: mockCheckoutOrchestrationService,
        },
        {
          provide: OrderCartDataService,
          useValue: {
            ...mockCartDataService,
            getCartItemsWithVariants: jest.fn().mockResolvedValue([]),
            getProductDetails: jest.fn().mockResolvedValue(new Map()),
          },
        },
        {
          provide: OrderCheckoutSessionService,
          useValue: mockCheckoutSessionService,
        },
        {
          provide: OrderCartProcessingService,
          useValue: {
            processBundleItems: jest.fn().mockResolvedValue({
              bundleVariantMapping: new Map(),
              flattenedBundleVariants: [],
            }),
            extractCartItems: jest.fn().mockResolvedValue([]),
            separateBundleAndVariantItems: jest.fn().mockReturnValue({
              bundleItems: [],
              variantItems: [],
            }),
            fetchCartItemProductData: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: OrderCalculationService,
          useValue: {
            calculateOrderTotals: jest.fn().mockResolvedValue({
              subtotal: 1000,
              totalGstAmount: 180,
            }),
          },
        },
        {
          provide: OrderPricingEngineService,
          useValue: {
            runPricingEngine: jest.fn().mockResolvedValue({
              pricingSnapshot: null,
              effectiveSubtotal: 1000,
            }),
          },
        },
        {
          provide: OrderDiscountEngineService,
          useValue: {
            applyDiscounts: jest.fn().mockResolvedValue({
              discountAmount: 0,
              discountSnapshot: null,
            }),
          },
        },
        {
          provide: OrderMetadataService,
          useValue: {
            createAndStoreMetadata: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: OrderPaymentIntentService,
          useValue: mockPaymentIntentService,
        },
        {
          provide: OrderCodFlowService,
          useValue: mockCodFlowService,
        },
        {
          provide: OrderValidationService,
          useValue: {
            getSellerState: jest.fn().mockReturnValue('Karnataka'),
            getCustomerId: jest.fn(),
          },
        },
        {
          provide: CheckoutStore,
          useValue: mockCheckoutStore,
        },
        {
          provide: DB_TOKEN,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<OrderPaymentIntentFlowService>(OrderPaymentIntentFlowService);
    checkoutOrchestrationService = module.get(OrderCheckoutOrchestrationService);
    cartDataService = module.get(OrderCartDataService);
    checkoutSessionService = module.get(OrderCheckoutSessionService);
    codFlowService = module.get(OrderCodFlowService);
    paymentIntentService = module.get(OrderPaymentIntentService);
    checkoutStore = module.get(CheckoutStore);
    metadataService = module.get(OrderMetadataService);
    cartProcessingService = module.get(OrderCartProcessingService);
  });

  describe('createPaymentIntent', () => {
    const userId = 'user_123';
    const createOrderDto: CreateOrderDto = {
      cartId: 'cart_123',
      shippingAddressId: 'address_123',
      billingAddressId: 'address_456',
      paymentMethod: 'razorpay',
    };

    it('should delegate to COD flow service if payment method is COD', async () => {
      dbSelectCallCount = 0; // Reset counter
      const codDto = { ...createOrderDto, paymentMethod: 'cod' };
      const mockCart = createMockCart();
      const mockOrder = createMockCart(); // Mock order response
      const checkoutSessionId = 'checkout_session_123';

      // Mock orchestration
      checkoutOrchestrationService.orchestrateCheckout.mockResolvedValue({
        customerId: 'customer_123',
        shippingAddressId: 'address_123',
        billingAddressId: 'address_456',
        cartId: 'cart_123',
        actualUserId: 'user_123',
        shippingAddress: {
          id: 'address_123',
          state: 'Karnataka',
        },
        billingAddress: {
          id: 'address_456',
          state: 'Karnataka',
        },
      });
      cartDataService.getCartForOrder.mockResolvedValue(mockCart);
      checkoutSessionService.getOrCreateSession.mockResolvedValue({
        sessionId: checkoutSessionId,
        lockAcquired: true,
      });
      checkoutStore.getCheckoutMetadata.mockResolvedValue({
        paymentMethod: 'cod',
      });
      metadataService.createAndStoreMetadata.mockResolvedValue(undefined);
      codFlowService.createCodOrder.mockResolvedValue(mockOrder as any);

      const result = await service.createPaymentIntent(userId, codDto);

      expect(codFlowService.createCodOrder).toHaveBeenCalled();
      expect(result).toHaveProperty('orderId');
    });

    it('should throw BadRequestException if cart is empty', async () => {
      dbSelectCallCount = 0; // Reset counter
      const emptyCart = createMockCart({ items: [] });
      
      checkoutOrchestrationService.orchestrateCheckout.mockResolvedValue({
        customerId: 'customer_123',
        shippingAddressId: 'address_123',
        billingAddressId: 'address_456',
        cartId: 'cart_123',
        actualUserId: 'user_123',
        shippingAddress: {
          id: 'address_123',
          state: 'Karnataka',
        },
        billingAddress: {
          id: 'address_456',
          state: 'Karnataka',
        },
      });
      cartDataService.getCartForOrder.mockResolvedValue(emptyCart);
      checkoutSessionService.getOrCreateSession.mockResolvedValue({
        sessionId: 'checkout_session_123',
        lockAcquired: true,
      });
      // Mock cartProcessingService to throw error when items are empty
      (cartProcessingService.extractCartItems as jest.Mock).mockRejectedValue(
        new BadRequestException('Cart is empty'),
      );

      await expect(
        service.createPaymentIntent(userId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create checkout session for payment intent', async () => {
      dbSelectCallCount = 0; // Reset counter
      const mockCart = createMockCart();
      const checkoutSessionId = 'checkout_session_123';

      cartDataService.getCartForOrder.mockResolvedValue(mockCart);
      checkoutSessionService.getOrCreateSession.mockResolvedValue({
        sessionId: checkoutSessionId,
        lockAcquired: true,
      });

      // Mock orchestration flow with shipping address
      checkoutOrchestrationService.orchestrateCheckout.mockResolvedValue({
        customerId: 'customer_123',
        shippingAddressId: 'address_123',
        billingAddressId: 'address_456',
        cartId: 'cart_123',
        actualUserId: 'user_123',
        shippingAddress: {
          id: 'address_123',
          state: 'Karnataka',
        },
        billingAddress: {
          id: 'address_456',
          state: 'Karnataka',
        },
      });

      paymentIntentService.createPaymentIntent.mockResolvedValue({
        id: 'payment_intent_123',
        clientSecret: 'secret_123',
        redirectUrl: 'https://razorpay.com/checkout',
      } as any);

      const result = await service.createPaymentIntent(userId, createOrderDto);

      expect(checkoutSessionService.getOrCreateSession).toHaveBeenCalled();
      expect(metadataService.createAndStoreMetadata).toHaveBeenCalled();
      expect(paymentIntentService.createPaymentIntent).toHaveBeenCalled();
      expect(result).toHaveProperty('paymentIntent');
      expect(result).toHaveProperty('checkoutSessionId');
      expect(result.checkoutSessionId).toBe(checkoutSessionId);
    });

    it('should handle guest checkout with sessionId', async () => {
      dbSelectCallCount = 0; // Reset counter
      const sessionId = 'session_123';
      const mockCart = createMockCart();

      cartDataService.getCartForOrder.mockResolvedValue(mockCart);
      checkoutSessionService.getOrCreateSession.mockResolvedValue({
        sessionId: 'checkout_session_123',
        lockAcquired: true,
      });

      checkoutOrchestrationService.orchestrateCheckout.mockResolvedValue({
        customerId: null,
        shippingAddressId: 'address_123',
        billingAddressId: 'address_456',
        cartId: 'cart_123',
        actualUserId: null,
        shippingAddress: {
          id: 'address_123',
          state: 'Karnataka',
        },
        billingAddress: {
          id: 'address_456',
          state: 'Karnataka',
        },
      });

      paymentIntentService.createPaymentIntent.mockResolvedValue({
        id: 'payment_intent_123',
        clientSecret: 'secret_123',
        redirectUrl: 'https://razorpay.com/checkout',
      } as any);

      await service.createPaymentIntent(null, createOrderDto, sessionId);

      expect(checkoutSessionService.getOrCreateSession).toHaveBeenCalled();
      expect(metadataService.createAndStoreMetadata).toHaveBeenCalled();
    });
  });
});
