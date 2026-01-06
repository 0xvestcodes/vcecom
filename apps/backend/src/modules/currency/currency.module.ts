import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { CurrencyController } from "./currency.controller";
import { CurrencyService } from "./currency.service";
import { CurrencyLayerProvider } from "./providers/currencylayer.provider";
import { ExchangeRateApiProvider } from "./providers/exchange-rate-api.provider";
import { FixerIoProvider } from "./providers/fixer-io.provider";
import { YahooFinanceProvider } from "./providers/yahoo-finance.provider";
import { CurrencyConversionService } from "./services/currency-conversion.service";
import { FxCacheService } from "./services/fx-cache.service";
import { FxRateService } from "./services/fx-rate.service";
import { StoreCurrencyController } from "./store-currency.controller";

@Module({
  imports: [DatabaseModule, RedisStoreModule],
  controllers: [CurrencyController, StoreCurrencyController],
  providers: [
    CurrencyService,
    FxRateService,
    FxCacheService,
    CurrencyConversionService,
    // FX Providers
    ExchangeRateApiProvider,
    FixerIoProvider,
    CurrencyLayerProvider,
    YahooFinanceProvider, // Fallback provider (always available)
  ],
  exports: [CurrencyService, FxRateService, CurrencyConversionService],
})
export class CurrencyModule {}
