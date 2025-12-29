import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { DB_TOKEN } from '../../../../modules/database/database.module';
import { BundlePricingService } from '../../../pricing/services/bundle-pricing.service';
import { CheckoutLockStore } from '../../../redis-store/stores/checkout-lock-store';
import { InventoryStore } from '../../../redis-store/stores/inventory-store';
import { ContextService } from '../../../../common/logging/context.service';
import { OrderInventoryService } from './order-inventory.service';
import { OrderInventoryMetricsService } from './order-inventory-metrics.service';

describe('OrderInventoryService', () => {
  let service: OrderInventoryService;
  let inventoryStore: jest.Mocked<InventoryStore>;
  let checkoutLockStore: jest.Mocked<CheckoutLockStore>;
  let bundlePricingService: jest.Mocked<BundlePricingService>;
  let db: jest.Mocked<any>;
  let logger: jest.Mocked<PinoLogger>;
  let contextService: jest.Mocked<ContextService>;

  beforeEach(async () => {
    const mockInventoryStore = {
      getReservedInventory: jest.fn(),
      getAvailableInventory: jest.fn(),
      commitReservationAtomic: jest.fn(),
      syncInventoryToDatabase: jest.fn(),
    };

    const mockCheckoutLockStore = {
      clearCheckoutLock: jest.fn(),
    };

    const mockBundlePricingService = {
      flattenBundleSelections: jest.fn(),
    };

    const mockDb = {
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockContextService = {
      getRequestId: jest.fn().mockReturnValue('test-request-id'),
      getUserId: jest.fn().mockReturnValue(null),
      get: jest.fn().mockReturnValue({}),
      set: jest.fn(),
      clear: jest.fn(),
    };

    const mockInventoryMetricsService = {
      recordInventoryCommitFailure: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderInventoryService,
        {
          provide: InventoryStore,
          useValue: mockInventoryStore,
        },
        {
          provide: CheckoutLockStore,
          useValue: mockCheckoutLockStore,
        },
        {
          provide: BundlePricingService,
          useValue: mockBundlePricingService,
        },
        {
          provide: OrderInventoryMetricsService,
          useValue: mockInventoryMetricsService,
        },
        {
          provide: DB_TOKEN,
          useValue: mockDb,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
        {
          provide: ContextService,
          useValue: mockContextService,
        },
      ],
    }).compile();

    service = module.get<OrderInventoryService>(OrderInventoryService);
    inventoryStore = module.get(InventoryStore);
    checkoutLockStore = module.get(CheckoutLockStore);
    bundlePricingService = module.get(BundlePricingService);
    db = module.get(DB_TOKEN);
    logger = module.get(PinoLogger);
    contextService = module.get(ContextService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('commitVariantItemsInventory', () => {
    it('should commit inventory for variant items successfully', async () => {
      const cartId = 'cart-123';
      const orderId = 'order-123';
      const variantItems = [
        { productVariantId: 'variant-1', quantity: 2 },
        { productVariantId: 'variant-2', quantity: 1 },
      ];

      inventoryStore.getReservedInventory.mockResolvedValue(0);
      inventoryStore.getAvailableInventory.mockResolvedValue(100);
      inventoryStore.commitReservationAtomic.mockResolvedValue(undefined);
      inventoryStore.syncInventoryToDatabase.mockResolvedValue(undefined);

      await service.commitVariantItemsInventory(cartId, orderId, variantItems);

      expect(inventoryStore.commitReservationAtomic).toHaveBeenCalledTimes(2);
      expect(inventoryStore.syncInventoryToDatabase).toHaveBeenCalledTimes(2);
    });

    it('should use soft mode when available inventory is low', async () => {
      const cartId = 'cart-123';
      const orderId = 'order-123';
      const variantItems = [{ productVariantId: 'variant-1', quantity: 2 }];

      inventoryStore.getReservedInventory.mockResolvedValue(5);
      inventoryStore.getAvailableInventory.mockResolvedValue(8); // <= 10
      inventoryStore.commitReservationAtomic.mockResolvedValue(undefined);
      inventoryStore.syncInventoryToDatabase.mockResolvedValue(undefined);

      await service.commitVariantItemsInventory(cartId, orderId, variantItems);

      expect(inventoryStore.commitReservationAtomic).toHaveBeenCalledWith(
        cartId,
        'variant-1',
        2,
        'soft',
      );
    });
  });

  describe('commitBundleItemsInventory', () => {
    it('should commit inventory for bundle items', async () => {
      const cartId = 'cart-123';
      const orderId = 'order-123';
      const bundleItems = [
        {
          id: 'bundle-1',
          quantity: 1,
          metadata: {
            type: 'bundle',
            selections: {
              'choice-1': 'variant-1',
              'choice-2': 'variant-2',
            },
          },
        },
      ];

      bundlePricingService.flattenBundleSelections.mockReturnValue([
        { variantId: 'variant-1', quantity: 1 },
        { variantId: 'variant-2', quantity: 1 },
      ]);

      inventoryStore.getReservedInventory.mockResolvedValue(0);
      inventoryStore.getAvailableInventory.mockResolvedValue(100);
      inventoryStore.commitReservationAtomic.mockResolvedValue(undefined);
      inventoryStore.syncInventoryToDatabase.mockResolvedValue(undefined);

      await service.commitBundleItemsInventory(cartId, orderId, bundleItems);

      expect(bundlePricingService.flattenBundleSelections).toHaveBeenCalled();
      expect(inventoryStore.commitReservationAtomic).toHaveBeenCalledTimes(2);
    });
  });

  describe('commitOrderInventory', () => {
    it('should commit inventory successfully for variant and bundle items', async () => {
      const cartId = 'cart-123';
      const orderId = 'order-123';
      const variantItems = [{ productVariantId: 'variant-1', quantity: 2 }];
      const bundleItems: any[] = [];

      inventoryStore.getReservedInventory.mockResolvedValue(0);
      inventoryStore.getAvailableInventory.mockResolvedValue(100);
      inventoryStore.commitReservationAtomic.mockResolvedValue(undefined);
      inventoryStore.syncInventoryToDatabase.mockResolvedValue(undefined);

      await service.commitOrderInventory(
        cartId,
        orderId,
        variantItems,
        bundleItems,
        true,
      );

      expect(inventoryStore.commitReservationAtomic).toHaveBeenCalled();
      expect(checkoutLockStore.clearCheckoutLock).toHaveBeenCalledWith(cartId);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle inventory commit failure gracefully', async () => {
      const cartId = 'cart-123';
      const orderId = 'order-123';
      const variantItems = [{ productVariantId: 'variant-1', quantity: 2 }];
      const bundleItems: any[] = [];

      const error = new Error('Redis connection failed');
      inventoryStore.getReservedInventory.mockRejectedValue(error);

      // Should not throw - order is already created
      await service.commitOrderInventory(
        cartId,
        orderId,
        variantItems,
        bundleItems,
        false,
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.anything(),
        'CRITICAL: Failed to commit inventory for order - manual reconciliation required',
      );
    });

    it('should clear checkout lock when requested', async () => {
      const cartId = 'cart-123';
      const orderId = 'order-123';
      const variantItems = [{ productVariantId: 'variant-1', quantity: 2 }];
      const bundleItems: any[] = [];

      inventoryStore.getReservedInventory.mockResolvedValue(0);
      inventoryStore.getAvailableInventory.mockResolvedValue(100);
      inventoryStore.commitReservationAtomic.mockResolvedValue(undefined);
      inventoryStore.syncInventoryToDatabase.mockResolvedValue(undefined);

      await service.commitOrderInventory(
        cartId,
        orderId,
        variantItems,
        bundleItems,
        true, // clearCheckoutLock = true
      );

      expect(checkoutLockStore.clearCheckoutLock).toHaveBeenCalledWith(cartId);
    });

    it('should not clear checkout lock when not requested', async () => {
      const cartId = 'cart-123';
      const orderId = 'order-123';
      const variantItems = [{ productVariantId: 'variant-1', quantity: 2 }];
      const bundleItems: any[] = [];

      inventoryStore.getReservedInventory.mockResolvedValue(0);
      inventoryStore.getAvailableInventory.mockResolvedValue(100);
      inventoryStore.commitReservationAtomic.mockResolvedValue(undefined);
      inventoryStore.syncInventoryToDatabase.mockResolvedValue(undefined);

      await service.commitOrderInventory(
        cartId,
        orderId,
        variantItems,
        bundleItems,
        false, // clearCheckoutLock = false
      );

      expect(checkoutLockStore.clearCheckoutLock).not.toHaveBeenCalled();
    });
  });
});
