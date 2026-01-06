import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  NotFoundErrorDto,
  TooManyRequestsErrorDto,
} from "../../common/dto/error-response.dto";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { extractSessionId } from "../../common/utils/session.utils";
import { HeartbeatStore } from "../redis-store/stores/heartbeat-store";
import { CartsService } from "./carts.service";
import { AddItemDto } from "./dto/add-item.dto";
import { ApplyDiscountDto } from "./dto/apply-discount.dto";
import { CartResponseDto } from "./dto/cart-response.dto";
import { UpdateItemDto } from "./dto/update-item.dto";

@ApiTags("store")
@Controller("store/cart")
export class CartsController {
  constructor(
    private readonly cartsService: CartsService,
    private readonly heartbeatStore: HeartbeatStore,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: "Get cart with enriched product data and resolved pricing",
    description:
      "Returns cart with complete product details (titles, images, SKUs), " +
      "resolved pricing (sale prices, price lists), detailed breakdowns, " +
      "and inventory status. Optionally includes checkout session data (shipping cost, payment fee) " +
      "when checkoutSessionId is provided. Creates cart if it doesn't exist.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiQuery({
    name: "checkoutSessionId",
    description: "Checkout session ID to include shipping cost and payment fee",
    required: false,
    type: String,
  })
  @ApiOkResponse({
    description: "Cart retrieved successfully with enriched data",
    type: CartResponseDto,
  })
  async getCart(
    @Request() req,
    @Query("checkoutSessionId") checkoutSessionId?: string,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);
    return this.cartsService.getCart(userId, sessionId, checkoutSessionId);
  }

  @Post("items")
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.CART_UPDATES)
  @ApiOperation({
    summary: "Add item to cart",
    description:
      "Add a product variant to cart. Creates cart if it doesn't exist. For authenticated users, uses customer cart. For guests, requires session ID.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiCreatedResponse({
    description: "Item added to cart successfully",
    type: CartResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or insufficient inventory",
    type: BadRequestErrorDto,
  })
  @ApiNotFoundResponse({
    description: "Product variant not found",
    type: NotFoundErrorDto,
  })
  @ApiConflictResponse({
    description: "Conflict - Cart item already exists or inventory conflict",
    type: ConflictErrorDto,
  })
  @ApiTooManyRequestsResponse({
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async addItem(
    @Request() req,
    @Body() addItemDto: AddItemDto,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);
    return this.cartsService.addItem(userId, sessionId, addItemDto);
  }

  @Put("items/:id")
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.CART_UPDATES)
  @ApiOperation({
    summary: "Update cart item quantity",
    description: "Update the quantity of an item in the cart",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiParam({
    name: "id",
    description: "Cart item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Cart item updated successfully",
    type: CartResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Cart item not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input or insufficient inventory",
  })
  async updateItem(
    @Request() req,
    @Param("id") id: string,
    @Body() updateDto: UpdateItemDto,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);
    return this.cartsService.updateItem(userId, sessionId, id, updateDto);
  }

  @Delete("items/:id")
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.CART_UPDATES)
  @ApiOperation({
    summary: "Remove item from cart",
    description: "Remove an item from the cart",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiParam({
    name: "id",
    description: "Cart item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Item removed from cart successfully",
    type: CartResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Cart item not found",
  })
  async removeItem(
    @Request() req,
    @Param("id") id: string,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);
    return this.cartsService.removeItem(userId, sessionId, id);
  }

  @Delete()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Clear cart",
    description: "Remove all items from the cart",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiOkResponse({
    description: "Cart cleared successfully",
    type: CartResponseDto,
  })
  async clearCart(@Request() req): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);
    return this.cartsService.clearCart(userId, sessionId);
  }

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create new cart",
    description:
      "Create a new cart session. Returns cartId, items, totals, expiresAt.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiCreatedResponse({
    description: "Cart created successfully",
    type: CartResponseDto,
  })
  async createCart(@Request() req): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);
    // getOrCreateCart will create if it doesn't exist
    return this.cartsService.getCart(userId, sessionId);
  }

  @Post("coupon")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Apply discount code to cart",
    description:
      "Apply a discount code to the cart. Validates the code and recalculates totals.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiOkResponse({
    description: "Discount applied successfully",
    type: CartResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid discount code or discount not applicable",
    type: BadRequestErrorDto,
  })
  @ApiNotFoundResponse({
    description: "Discount code not found",
    type: NotFoundErrorDto,
  })
  @ApiConflictResponse({
    description: "Conflict - Discount already applied or not applicable",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 422,
    description:
      "Unprocessable entity - Discount validation failed (minimum order amount, customer group, etc.)",
    type: BadRequestErrorDto,
  })
  async applyDiscount(
    @Request() req,
    @Body() applyDiscountDto: ApplyDiscountDto,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);
    return this.cartsService.applyDiscount(
      userId,
      sessionId,
      applyDiscountDto.code,
    );
  }

  @Post("reset")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reset cart",
    description:
      "Remove all items from the cart (alias for DELETE /store/cart)",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiOkResponse({
    description: "Cart reset successfully",
    type: CartResponseDto,
  })
  async resetCart(@Request() req): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);
    return this.cartsService.clearCart(userId, sessionId);
  }

  @Delete("coupon")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Remove discount code from cart",
    description:
      "Remove the applied discount code from the cart and recalculate totals.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiOkResponse({
    description: "Discount removed successfully",
    type: CartResponseDto,
  })
  async removeDiscount(@Request() req): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);
    return this.cartsService.removeDiscount(userId, sessionId);
  }

  @Post("heartbeat")
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.CART_HEARTBEAT)
  @ApiOperation({
    summary: "Send cart heartbeat",
    description:
      "Send heartbeat signal to keep cart reservations alive. Should be called every 30 seconds while cart is active.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiOkResponse({
    description: "Heartbeat recorded successfully",
  })
  @ApiBadRequestResponse({
    description: "Cart not found",
    type: BadRequestErrorDto,
  })
  async heartbeat(@Request() req): Promise<{ success: boolean }> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);

    // Get cart to ensure it exists
    const cart = await this.cartsService.getCart(userId, sessionId);
    if (!cart) {
      throw new BadRequestException("Cart not found");
    }

    // Record heartbeat
    await this.heartbeatStore.recordHeartbeat(cart.id);

    return { success: true };
  }

  @Put()
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.CART_UPDATES)
  @ApiOperation({
    summary: "Update cart currency",
    description: "Update the currency for the cart and recalculate totals",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiOkResponse({
    description: "Cart currency updated successfully",
    type: CartResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid currency code",
    type: BadRequestErrorDto,
  })
  async updateCurrency(
    @Request() req,
    @Body() body: { currency: string },
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const sessionId = extractSessionId(req);
    return this.cartsService.updateCurrency(userId, sessionId, body.currency);
  }
}
