import {
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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request as ExpressRequest } from "express";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { CreditWalletDto, DebitWalletDto } from "./dto/credit-wallet.dto";
import {
  CreateLoyaltyRuleDto,
  LoyaltyRuleResponseDto,
  UpdateLoyaltyRuleDto,
} from "./dto/loyalty-rule.dto";
import { WalletBalanceResponseDto } from "./dto/wallet-balance.dto";
import { WalletTransactionHistoryResponseDto } from "./dto/wallet-transaction.dto";
import { LoyaltyRulesService } from "./services/loyalty-rules.service";
import { WalletService } from "./services/wallet.service";
import { WalletTransactionsService } from "./services/wallet-transactions.service";

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@ApiTags("admin")
@Controller("admin/wallet")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class AdminWalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly walletTransactionsService: WalletTransactionsService,
    private readonly loyaltyRulesService: LoyaltyRulesService,
  ) {}

  @Get("customers")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "List all customer wallets",
    description: "Get a list of all customer wallets with balances",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of wallets to return (default: 50)",
  })
  @ApiQuery({
    name: "offset",
    required: false,
    type: Number,
    description: "Number of wallets to skip (default: 0)",
  })
  @ApiOkResponse({
    description: "Customer wallets retrieved successfully",
  })
  async getCustomerWallets(
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ) {
    // TODO: Implement pagination for customer wallets list
    // For now, return empty array
    return {
      wallets: [],
      total: 0,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    };
  }

  @Get("customers/:customerId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get customer wallet details",
    description: "Get wallet balance and details for a specific customer",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer ID",
  })
  @ApiOkResponse({
    description: "Customer wallet retrieved successfully",
    type: WalletBalanceResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async getCustomerWallet(
    @Param("customerId") customerId: string,
  ): Promise<WalletBalanceResponseDto> {
    return this.walletService.getBalance(customerId);
  }

  @Post("customers/:customerId/credit")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_WRITE)
  @ApiOperation({
    summary: "Credit customer wallet",
    description: "Add funds to a customer's wallet (admin only)",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer ID",
  })
  @ApiOkResponse({
    description: "Wallet credited successfully",
    type: WalletBalanceResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async creditWallet(
    @Param("customerId") customerId: string,
    @Body() creditDto: CreditWalletDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<WalletBalanceResponseDto> {
    await this.walletService.creditWallet(
      customerId,
      creditDto.amount,
      creditDto.description,
      {
        orderId: creditDto.orderId,
        refundId: creditDto.refundId,
        adminId: req.user.id,
        metadata: creditDto.metadata,
      },
    );
    return this.walletService.getBalance(customerId);
  }

  @Post("customers/:customerId/debit")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_WRITE)
  @ApiOperation({
    summary: "Debit customer wallet",
    description: "Subtract funds from a customer's wallet (admin only)",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer ID",
  })
  @ApiOkResponse({
    description: "Wallet debited successfully",
    type: WalletBalanceResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or insufficient balance",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async debitWallet(
    @Param("customerId") customerId: string,
    @Body() debitDto: DebitWalletDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<WalletBalanceResponseDto> {
    await this.walletService.debitWallet(
      customerId,
      debitDto.amount,
      debitDto.description,
      {
        orderId: debitDto.orderId,
        metadata: {
          ...debitDto.metadata,
          adminId: req.user.id,
        },
      },
    );
    return this.walletService.getBalance(customerId);
  }

  @Get("transactions")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all wallet transactions",
    description: "Get all wallet transactions with optional filters",
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
    name: "customerId",
    required: false,
    type: String,
    description: "Filter by customer ID",
  })
  @ApiQuery({
    name: "type",
    required: false,
    type: String,
    description: "Filter by transaction type",
  })
  @ApiQuery({
    name: "orderId",
    required: false,
    type: String,
    description: "Filter by order ID",
  })
  @ApiOkResponse({
    description: "Transactions retrieved successfully",
    type: WalletTransactionHistoryResponseDto,
  })
  async getAllTransactions(
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
    @Query("customerId") customerId?: string,
    @Query("type") type?: string,
    @Query("orderId") orderId?: string,
  ): Promise<WalletTransactionHistoryResponseDto> {
    return this.walletTransactionsService.getAllTransactions({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      customerId,
      type,
      orderId,
    });
  }

  @Get("rules")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "List all loyalty rules",
    description: "Get all loyalty rules with optional filters",
  })
  @ApiQuery({
    name: "type",
    required: false,
    enum: ["earning", "redemption"],
    description: "Filter by rule type",
  })
  @ApiQuery({
    name: "isActive",
    required: false,
    type: Boolean,
    description: "Filter by active status",
  })
  @ApiOkResponse({
    description: "Loyalty rules retrieved successfully",
    type: [LoyaltyRuleResponseDto],
  })
  async getRules(
    @Query("type") type?: "earning" | "redemption",
    @Query("isActive") isActive?: boolean,
  ): Promise<LoyaltyRuleResponseDto[]> {
    return this.loyaltyRulesService.getAllRules({
      type,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    });
  }

  @Get("rules/:id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get loyalty rule by ID",
    description: "Get details of a specific loyalty rule",
  })
  @ApiParam({
    name: "id",
    description: "Rule ID",
  })
  @ApiOkResponse({
    description: "Loyalty rule retrieved successfully",
    type: LoyaltyRuleResponseDto,
  })
  async getRule(@Param("id") id: string): Promise<LoyaltyRuleResponseDto> {
    return this.loyaltyRulesService.getRuleById(id);
  }

  @Post("rules")
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_WRITE)
  @ApiOperation({
    summary: "Create loyalty rule",
    description: "Create a new loyalty earning or redemption rule",
  })
  @ApiCreatedResponse({
    description: "Loyalty rule created successfully",
    type: LoyaltyRuleResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
  })
  async createRule(
    @Body() createDto: CreateLoyaltyRuleDto,
  ): Promise<LoyaltyRuleResponseDto> {
    return this.loyaltyRulesService.createRule({
      name: createDto.name,
      type: createDto.type,
      ruleType: createDto.ruleType,
      pointsPerRupee: createDto.pointsPerRupee,
      rupeesPerPoint: createDto.rupeesPerPoint,
      minOrderValue: createDto.minOrderValue,
      minPointsToRedeem: createDto.minPointsToRedeem,
      maxPointsPerOrder: createDto.maxPointsPerOrder,
      validFrom: createDto.validFrom
        ? new Date(createDto.validFrom)
        : undefined,
      validUntil: createDto.validUntil
        ? new Date(createDto.validUntil)
        : undefined,
      customerGroupId: createDto.customerGroupId,
      metadata: createDto.metadata,
    });
  }

  @Put("rules/:id")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_WRITE)
  @ApiOperation({
    summary: "Update loyalty rule",
    description: "Update an existing loyalty rule",
  })
  @ApiParam({
    name: "id",
    description: "Rule ID",
  })
  @ApiOkResponse({
    description: "Loyalty rule updated successfully",
    type: LoyaltyRuleResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
  })
  async updateRule(
    @Param("id") id: string,
    @Body() updateDto: UpdateLoyaltyRuleDto,
  ): Promise<LoyaltyRuleResponseDto> {
    return this.loyaltyRulesService.updateRule(id, {
      name: updateDto.name,
      isActive: updateDto.isActive,
      pointsPerRupee: updateDto.pointsPerRupee,
      rupeesPerPoint: updateDto.rupeesPerPoint,
      minOrderValue: updateDto.minOrderValue,
      minPointsToRedeem: updateDto.minPointsToRedeem,
      maxPointsPerOrder: updateDto.maxPointsPerOrder,
      validFrom: updateDto.validFrom
        ? new Date(updateDto.validFrom)
        : undefined,
      validUntil: updateDto.validUntil
        ? new Date(updateDto.validUntil)
        : undefined,
      customerGroupId: updateDto.customerGroupId,
      metadata: updateDto.metadata,
    });
  }

  @Delete("rules/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_WRITE)
  @ApiOperation({
    summary: "Delete loyalty rule",
    description: "Delete a loyalty rule",
  })
  @ApiParam({
    name: "id",
    description: "Rule ID",
  })
  @ApiOkResponse({
    description: "Loyalty rule deleted successfully",
  })
  async deleteRule(@Param("id") id: string): Promise<void> {
    await this.loyaltyRulesService.deleteRule(id);
  }
}
