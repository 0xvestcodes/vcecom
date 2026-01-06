import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { StoreContext } from "../store-context/store-context.interface";

/**
 * Decorator to extract store context from request
 * Usage: @StoreContextParam() storeContext: StoreContext
 * Usage: @StoreContextParam('storeId') storeId: string
 */
export const StoreContextParam = createParamDecorator(
  (data: keyof StoreContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const storeContext = request.storeContext as StoreContext | undefined;

    if (!storeContext) {
      return undefined;
    }

    // If specific property requested, return it
    if (data) {
      return storeContext[data];
    }

    // Otherwise return full context
    return storeContext;
  },
);
