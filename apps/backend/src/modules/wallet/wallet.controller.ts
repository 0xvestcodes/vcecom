import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { customers, eq } from "@vcecom/db";
import { Request as ExpressRequest } from "express";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import {
  RedeemPointsDto,
  RedeemPointsResponseDto,
} from "./dto/redeem-points.dto";
import { WalletBalanceResponseDto } from "./dto/wallet-balance.dto";
import { WalletTransactionHistoryResponseDto } from "./dto/wallet-transaction.dto";
import { LoyaltyService } from "./services/loyalty.service";
import { WalletService } from "./services/wallet.service";
import { WalletTransactionsService } from "./services/wallet-transactions.service";

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@ApiTags("store")
@Controller("store/wallet")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
@Roles("customer")
export class WalletController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly walletService: WalletService,
    private readonly walletTransactionsService: WalletTransactionsService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  /**
   * Get customer ID from user ID
   */
  private async getCustomerId(userId: string): Promise<string> {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);

    if (!customer) {
      throw new NotFoundException("Customer profile not found");
    }

    return customer.id;
  }

  @Get("balance")
  @RateLimit(RATE_LIMIT_PRESETS.READ)
  @ApiOperation({
    summary: "Get wallet balance and loyalty points",
    description:
      "Get the current wallet balance and loyalty points for the authenticated customer",
  })
  @ApiOkResponse({
    description: "Wallet balance retrieved successfully",
    type: WalletBalanceResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async getBalance(
    @Request() req: AuthenticatedRequest,
  ): Promise<WalletBalanceResponseDto> {
    const customerId = await this.getCustomerId(req.user.id);
    return this.walletService.getBalance(customerId);
  }

  @Get("transactions")
  @RateLimit(RATE_LIMIT_PRESETS.READ)
  @ApiOperation({
    summary: "Get transaction history",
    description: "Get transaction history for the authenticated customer",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of transactions to return (default: 50)",
  })
  @ApiQuery({
    name: "offset",
    required: false,
    type: Number,
    description: "Number of transactions to skip (default: 0)",
  })
  @ApiQuery({
    name: "type",
    required: false,
    type: String,
    description: "Filter by transaction type",
  })
  @ApiOkResponse({
    description: "Transaction history retrieved successfully",
    type: WalletTransactionHistoryResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async getTransactionHistory(
    @Request() req: AuthenticatedRequest,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
    @Query("type") type?: string,
  ): Promise<WalletTransactionHistoryResponseDto> {
    const customerId = await this.getCustomerId(req.user.id);
    return this.walletTransactionsService.getTransactionHistory(customerId, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      type,
    });
  }

  @Post("redeem-points")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.WRITE)
  @ApiOperation({
    summary: "Redeem loyalty points",
    description: "Redeem loyalty points for a discount amount",
  })
  @ApiOkResponse({
    description: "Points redeemed successfully",
    type: RedeemPointsResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or insufficient points",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async redeemPoints(
    @Request() req: AuthenticatedRequest,
    @Body() redeemDto: RedeemPointsDto,
  ): Promise<RedeemPointsResponseDto> {
    const customerId = await this.getCustomerId(req.user.id);
    return this.loyaltyService.redeemPoints(
      customerId,
      redeemDto.points,
      redeemDto.orderValue,
      redeemDto.orderId,
    );
  }
}
