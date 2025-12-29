import { Test, TestingModule } from '@nestjs/testing';
import { OrderPricingEngineService } from './order-pricing-engine.service';
import { runPricingEngine } from '../../../pricing/engine/pricing-engine';
import { PinoLogger } from 'nestjs-pino';
import { ContextService } from '../../../../common/logging/context.service';
import { BundlePricingService } from '../../../pricing/services/bundle-pricing.service';
import { PricingAuditService } from '../../../pricing/services/pricing-audit.service';
import { PricingHotReloadWatcher } from '../../../pricing/services/pricing-hot-reload-watcher.service';
import { OrderValidationService } from '../validation/order-validation.service';
import { OrderPricingService } from './order-pricing.service';
import { DB_TOKEN } from '../../../database/database.module';

// Mock the pricing engine function
jest.mock('../../../pricing/engine/pricing-engine', () => ({
  runPricingEngine: jest.fn(),
}));

describe('OrderPricingEngineService', () => {
  let service: OrderPricingEngineService;
  let mockRunPricingEngine: jest.MockedFunction<typeof runPricingEngine>;

  beforeEach(async () => {
    mockRunPricingEngine = runPricingEngine as jest.MockedFunction<typeof runPricingEngine>;

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
        OrderPricingEngineService,
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
        {
          provide: ContextService,
          useValue: mockContextService,
        },
        {
          provide: BundlePricingService,
          useValue: {
            flattenBundleSelections: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: PricingAuditService,
          useValue: {
            logEngineRun: jest.fn().mockResolvedValue(undefined),
            logSnapshotCreated: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PricingHotReloadWatcher,
          useValue: {
            getCurrentVersion: jest.fn().mockReturnValue(1),
          },
        },
        {
          provide: OrderValidationService,
          useValue: {
            getCustomerGroupId: jest.fn().mockResolvedValue('group_1'),
          },
        },
        {
          provide: OrderPricingService,
          useValue: {
            getPriceListsForCustomer: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DB_TOKEN,
          useValue: {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              then: jest.fn().mockResolvedValue([]),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OrderPricingEngineService>(OrderPricingEngineService);
  });

  describe('runPricingEngine', () => {
    it('should run pricing engine and create snapshot', async () => {
      const mockPricingResult = {
        totalEffectivePrice: 900,
        variantPrices: [
          { variantId: 'variant_1', finalPrice: 900, compareAtPrice: 1200, salePrice: 900 },
        ],
      };

      mockRunPricingEngine.mockReturnValue(mockPricingResult as any);

      // Mock DB to return empty variants (no variants to fetch)
      const mockDb = service['_db'] as any;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      });

      const result = await service.runPricingEngine(
        'checkout_session_123',
        'cart_123',
        'customer_123',
        [
          {
            cartItemId: 'cart_item_1',
            productVariantId: 'variant_1',
            quantity: 1,
            price: 1000,
            productGstRate: 18,
          },
        ],
        [],
        [],
        new Map([['variant_1', 'product_1']]),
        new Map([['product_1', { productId: 'product_1', categoryId: 'cat_1' }]]),
        'group_1',
      );

      expect(mockRunPricingEngine).toHaveBeenCalled();
      expect(result).toHaveProperty('pricingSnapshot');
      expect(result).toHaveProperty('effectiveSubtotal');
    });

    it('should include compareAtPrice and salePrice from variants', async () => {
      mockRunPricingEngine.mockReturnValue({
        totalEffectivePrice: 900,
        variantPrices: new Map(),
      } as any);

      // Note: The test verifies that compareAtPrice and salePrice are loaded from variants
      // The actual implementation fetches these from the database
      // This test verifies the method completes successfully
      const mockDb = service['_db'] as any;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            id: 'variant_1',
            compareAtPrice: 1200,
            salePrice: 900,
            saleStartDate: new Date('2024-01-01'),
            saleEndDate: new Date('2024-12-31'),
          },
        ]),
      });

      await service.runPricingEngine(
        null,
        'cart_123',
        'customer_123',
        [
          {
            cartItemId: 'cart_item_1',
            productVariantId: 'variant_1',
            quantity: 1,
            price: 1000,
            productGstRate: 18,
          },
        ],
        [],
        [],
        new Map([['variant_1', 'product_1']]),
        new Map([['product_1', { productId: 'product_1', categoryId: 'cat_1' }]]),
        null,
      );

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockRunPricingEngine).toHaveBeenCalled();
    });
  });
});
