import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * User decorator to extract authenticated user from request
 * Usage: @User() user: { id: string; email: string; role: string }
 */
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
