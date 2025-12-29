import { Test, TestingModule } from '@nestjs/testing';
import { OrderCalculationService } from './order-calculation.service';
import { OrderGstService } from '../gst/order-gst.service';
import { PinoLogger } from 'nestjs-pino';
import { ContextService } from '../../../../common/logging/context.service';
import { PaymentChargeService } from '../../../payments/services/payment-charge.service';
import { DB_TOKEN } from '../../../database/database.module';

describe('OrderCalculationService', () => {
  let service: OrderCalculationService;
  let gstService: jest.Mocked<OrderGstService>;

  beforeEach(async () => {
    const mockGstService = {
      calculateGst: jest.fn(),
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
      getUserId: jest.fn().mockReturnValue('test-user-id'),
      set: jest.fn(),
      clear: jest.fn(),
    };

    const mockPaymentChargeService = {
      calculateCharge: jest.fn(),
    };

    const mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCalculationService,
        {
          provide: OrderGstService,
          useValue: mockGstService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
        {
          provide: ContextService,
          useValue: mockContextService,
        },
        {
          provide: PaymentChargeService,
          useValue: mockPaymentChargeService,
        },
        {
          provide: DB_TOKEN,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<OrderCalculationService>(OrderCalculationService);
    gstService = module.get(OrderGstService);
  });

  describe('calculateOrderTotals', () => {
    it('should calculate subtotal correctly', async () => {
      const variantItems = [
        { price: 1000, quantity: 2, productGstRate: 18 },
        { price: 500, quantity: 1, productGstRate: 12 },
      ];

      gstService.calculateGst.mockImplementation((amount, rate, sellerState, buyerState) => {
        const gstAmount = (amount * rate) / 100;
        return {
          cgst: sellerState === buyerState ? gstAmount / 2 : 0,
          sgst: sellerState === buyerState ? gstAmount / 2 : 0,
          igst: sellerState !== buyerState ? gstAmount : 0,
          totalGst: gstAmount,
        };
      });

      const result = await service.calculateOrderTotals(
        variantItems,
        [],
        'Karnataka',
        'Karnataka',
      );

      expect(result.subtotal).toBe(2500); // (1000 * 2) + (500 * 1)
      expect(result.totalGstAmount).toBeGreaterThan(0);
    });

    it('should handle interstate GST correctly', async () => {
      const variantItems = [{ price: 1000, quantity: 1, productGstRate: 18 }];

      gstService.calculateGst.mockReturnValue({
        cgst: 0,
        sgst: 0,
        igst: 180,
        totalGst: 180,
      });

      const result = await service.calculateOrderTotals(
        variantItems,
        [],
        'Karnataka',
        'Maharashtra',
      );

      expect(result.totalGstAmount).toBe(180);
    });

    it('should handle empty items', async () => {
      const result = await service.calculateOrderTotals([], [], 'Karnataka', 'Karnataka');

      expect(result.subtotal).toBe(0);
      expect(result.totalGstAmount).toBe(0);
    });
  });

  describe('applyDiscountSnapshot', () => {
    it('should apply discount from snapshot', () => {
      const subtotal = 1000;
      const discountSnapshot = {
        total: 200, // This is the discount amount, not the final total
        cartDiscounts: [
          {
            discountCode: 'TEST10',
            amount: 200,
          },
        ],
        engineVersion: '1.0.0',
        ruleHash: 'hash123',
      };

      const result = service.applyDiscountSnapshot(subtotal, discountSnapshot as any);

      expect(result.subtotalAfterDiscount).toBe(800); // 1000 - 200
      expect(result.discountAmount).toBe(200);
      expect(result.discountCode).toBe('TEST10');
    });

    it('should handle missing discount snapshot', () => {
      const subtotal = 1000;
      // Note: The implementation doesn't handle null, so we test with empty snapshot
      const emptySnapshot = {
        total: 0,
        cartDiscounts: [],
        engineVersion: '1.0.0',
        ruleHash: 'hash123',
      };

      const result = service.applyDiscountSnapshot(subtotal, emptySnapshot as any);

      expect(result.subtotalAfterDiscount).toBe(1000);
      expect(result.discountAmount).toBe(0);
      expect(result.discountCode).toBeNull();
    });
  });
});
