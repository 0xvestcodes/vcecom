import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";

export interface RequestContext {
  requestId: string;
  spanId?: string;
  traceId?: string;
  correlationId?: string;
  ip?: string;
  customerId?: string;
  cartId?: string;
  orderId?: string;
  checkoutId?: string;
  fingerprint?: string;
}

/**
 * Service for managing request-scoped context using AsyncLocalStorage
 * Provides thread-local storage for request metadata across async operations
 */
@Injectable()
export class ContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  /**
   * Run a function within a context
   */
  run<T>(context: RequestContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn);
  }

  /**
   * Get the current context
   */
  get(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get a specific value from the current context
   */
  getValue<K extends keyof RequestContext>(
    key: K,
  ): RequestContext[K] | undefined {
    const context = this.get();
    return context?.[key];
  }

  /**
   * Set a value in the current context (creates new context if none exists)
   */
  setValue<K extends keyof RequestContext>(
    key: K,
    value: RequestContext[K],
  ): void {
    const current = this.get();
    if (current) {
      // Type-safe assignment - we know the key exists on RequestContext
      // biome-ignore lint/suspicious/noExplicitAny: Type-safe assignment to RequestContext
      (current as any)[key] = value;
    }
  }

  /**
   * Get requestId from context (most commonly used)
   */
  getRequestId(): string | undefined {
    return this.getValue("requestId");
  }

  /**
   * Get traceId from context
   */
  getTraceId(): string | undefined {
    return this.getValue("traceId");
  }

  /**
   * Get spanId from context
   */
  getSpanId(): string | undefined {
    return this.getValue("spanId");
  }
}
