import { Test, TestingModule } from '@nestjs/testing';
import { OrderDiscountService } from './order-discount.service';
import { runDiscountEngine } from '../../../discounts/engine/discount-engine';
import { DB_TOKEN } from '../../../database/database.module';
import { customers } from '@vcecom/db';
import { PinoLogger } from 'nestjs-pino';
import { ContextService } from '../../../../common/logging/context.service';
import { DiscountsService } from '../../../discounts/discounts.service';
import { DiscountSnapshotValidator } from '../../../discounts/services/discount-snapshot-validator.service';
import { DiscountAuditService } from '../../../discounts/services/discount-audit.service';
import { DriftDetectorService } from '../../../discounts/services/drift-detector.service';
import { HotReloadWatcher } from '../../../discounts/services/hot-reload-watcher.service';
import { RulesetBundleService } from '../../../discounts/services/ruleset-bundle.service';
import { DiscountProfiler } from '../../../discounts/services/discount-profiler.service';

// Mock the discount engine function
jest.mock('../../../discounts/engine/discount-engine', () => ({
  runDiscountEngine: jest.fn(),
}));

describe('OrderDiscountService', () => {
  let service: OrderDiscountService;
  let mockRunDiscountEngine: jest.MockedFunction<typeof runDiscountEngine>;
  let db: any;
  let mockDiscountsService: any;

  beforeEach(async () => {
    mockRunDiscountEngine = runDiscountEngine as jest.MockedFunction<typeof runDiscountEngine>;

    const mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
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
        OrderDiscountService,
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
        {
          provide: ContextService,
          useValue: mockContextService,
        },
        {
          provide: DiscountsService,
          useValue: {
            validateDiscount: jest.fn(),
            getEligibleDiscounts: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DiscountSnapshotValidator,
          useValue: {
            validateSnapshot: jest.fn(),
          },
        },
        {
          provide: DiscountAuditService,
          useValue: {
            logEngineRun: jest.fn(),
            logSnapshotCreated: jest.fn(),
          },
        },
        {
          provide: DriftDetectorService,
          useValue: {
            detectDrift: jest.fn(),
          },
        },
        {
          provide: HotReloadWatcher,
          useValue: {
            getCurrentVersion: jest.fn().mockReturnValue(1),
          },
        },
        {
          provide: RulesetBundleService,
          useValue: {},
        },
        {
          provide: DiscountProfiler,
          useValue: {
            recordEngineRun: jest.fn(),
          },
        },
        {
          provide: DB_TOKEN,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<OrderDiscountService>(OrderDiscountService);
    db = module.get(DB_TOKEN);
    // Get the mock instance for later modification
    mockDiscountsService = module.get(DiscountsService);
  });

  describe('applyDiscountsToOrder', () => {
    it('should apply discounts using discount engine', async () => {
      const mockCustomer = {
        customerGroupId: 'group_1',
      };

      db.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      });

      // Mock getEligibleDiscounts to return discounts
      mockDiscountsService.getEligibleDiscounts.mockResolvedValue([
        { id: 'discount_1', code: 'TEST10' },
      ]);

      const mockDiscountResult = {
        discountTotal: 250,
        appliedDiscountIds: ['discount_1'],
        appliedDiscounts: [{ id: 'discount_1', amount: 250 }],
        cartDiscounts: [{ id: 'discount_1', amount: 250 }],
      };

      mockRunDiscountEngine.mockReturnValue(mockDiscountResult as any);

      const result = await service.applyDiscountsToOrder(
        'cart_123',
        'checkout_session_123',
        2500, // effectiveSubtotal
        'customer_123', // customerId
        'user_123', // userId
        'TEST10', // discountCode
        100, // shippingCost
        [
          {
            id: 'cart_item_1',
            productVariantId: 'variant_1',
            productId: 'product_1',
            categoryId: 'cat_1',
            collectionIds: [],
            tagIds: [],
            price: 1000,
            quantity: 2,
          },
        ], // cartItemsForEngine
        [], // bundleCartItems
        new Map(), // bundleVariantMapping
        [], // flattenedBundleVariants
      );

      expect(mockDiscountsService.getEligibleDiscounts).toHaveBeenCalled();
      expect(db.select).toHaveBeenCalled();
      expect(mockRunDiscountEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({
            customerGroupIds: ['group_1'],
          }),
        }),
      );
      expect(result.discountAmount).toBe(250);
    });

    it('should handle customer without group', async () => {
      const mockCustomer = {
        customerGroupId: null,
      };

      db.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      });

      mockDiscountsService.getEligibleDiscounts.mockResolvedValue([
        { id: 'discount_1' },
      ]);

      mockRunDiscountEngine.mockReturnValue({
        discountTotal: 0,
        appliedDiscountIds: [],
        appliedDiscounts: [],
      } as any);

      await service.applyDiscountsToOrder(
        'cart_123',
        null,
        1000,
        'customer_123',
        null,
        null,
        0,
        [],
        [],
        new Map(),
        [],
      );

      expect(mockRunDiscountEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({
            customerGroupIds: [],
          }),
        }),
      );
    });

    it('should parse customerGroupIds from customer data', async () => {
      const mockCustomer = {
        customerGroupId: 'group_1',
      };

      db.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      });

      mockDiscountsService.getEligibleDiscounts.mockResolvedValue([
        { id: 'discount_1', code: 'TEST10' },
      ]);

      mockRunDiscountEngine.mockReturnValue({
        discountTotal: 0,
        appliedDiscountIds: [],
        appliedDiscounts: [],
      } as any);

      await service.applyDiscountsToOrder(
        'cart_123',
        null,
        1000,
        'customer_123',
        null,
        'TEST10',
        0,
        [],
        [],
        new Map(),
        [],
      );

      expect(mockRunDiscountEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({
            customerGroupIds: ['group_1'],
          }),
        }),
      );
    });
  });
});
