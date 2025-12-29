import { config } from "dotenv";

// Load environment variables for E2E tests
config({ path: ".env.test" });

// Mock environment variables if not set
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/vcecom_test";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Increase timeout for E2E tests
jest.setTimeout(60000);
