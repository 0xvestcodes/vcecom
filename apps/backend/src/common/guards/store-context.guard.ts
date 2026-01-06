import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import type { StoreContext } from "../store-context/store-context.interface";

/**
 * Guard to ensure store context is present in request
 * Throws BadRequestException if store context is missing
 */
@Injectable()
export class StoreContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const storeContext = request.storeContext as StoreContext | undefined;

    if (!storeContext) {
      throw new BadRequestException(
        "Store context is required. Please provide X-Store-ID header.",
      );
    }

    return true;
  }
}
