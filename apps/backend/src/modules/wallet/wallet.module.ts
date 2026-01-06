import { Module } from "@nestjs/common";
import { AdminWalletController } from "./admin-wallet.controller";
import { LoyaltyService } from "./services/loyalty.service";
import { LoyaltyRulesService } from "./services/loyalty-rules.service";
import { WalletService } from "./services/wallet.service";
import { WalletTransactionsService } from "./services/wallet-transactions.service";
import { WalletController } from "./wallet.controller";

@Module({
  controllers: [WalletController, AdminWalletController],
  providers: [
    WalletService,
    WalletTransactionsService,
    LoyaltyService,
    LoyaltyRulesService,
  ],
  exports: [
    WalletService,
    WalletTransactionsService,
    LoyaltyService,
    LoyaltyRulesService,
  ],
})
export class WalletModule {}
