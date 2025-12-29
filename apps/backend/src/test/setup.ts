import { config } from "dotenv";

// Load environment variables for tests
config({ path: ".env.test" });

// Mock environment variables if not set
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/vcecom_test";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock tracing decorator to preserve original method behavior
jest.mock("../common/tracing/trace.decorator", () => ({
  Trace:
    (options?: any) =>
    (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      // Return the original descriptor unchanged to preserve method behavior
      // This ensures methods work normally in tests without tracing overhead
      if (!descriptor || typeof descriptor.value !== "function") {
        return descriptor;
      }
      // Preserve the original method
      return descriptor;
    },
}));

// Mock DiscountsService and related services to avoid circular dependency issues in tests
// This prevents the "Cannot access 'DiscountsService' before initialization" error
jest.mock("../modules/discounts/discounts.service", () => {
  return {
    DiscountsService: jest.fn().mockImplementation(() => ({
      validateDiscount: jest.fn(),
      getEligibleDiscounts: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  };
});

jest.mock("../modules/discounts/services/ruleset-rebuilder.service", () => {
  return {
    RulesetRebuilder: jest.fn().mockImplementation(() => ({
      rebuildFromDb: jest.fn(),
      rebuildAndActivate: jest.fn(),
    })),
  };
});

jest.mock("../modules/discounts/services/discount-invalidation.service", () => {
  return {
    DiscountInvalidationService: jest.fn().mockImplementation(() => ({
      invalidateDiscount: jest.fn(),
      invalidateAll: jest.fn(),
    })),
  };
});

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};
