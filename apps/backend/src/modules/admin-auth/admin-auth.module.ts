import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { getValidatedJwtSecret } from "../../common/config/jwt-secret.validation";
import { ContextModule } from "../../common/logging/context.module";
import { LoggerModule } from "../../common/logging/logger.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { AdminActivityService } from "./admin-activity.service";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AdminMfaController } from "./admin-mfa.controller";
import { AdminMfaService } from "./admin-mfa.service";
import { AdminSessionsService } from "./admin-sessions.service";
import { AdminLoginRateLimitGuard } from "./guards/rate-limit.guard";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: getValidatedJwtSecret(),
      signOptions: {
        expiresIn: process.env.ADMIN_ACCESS_TOKEN_EXPIRES_IN || "15m",
      },
    }),
    RedisStoreModule,
    LoggerModule,
    ContextModule,
  ],
  controllers: [AdminAuthController, AdminMfaController],
  providers: [
    AdminAuthService,
    AdminSessionsService,
    AdminActivityService,
    AdminLoginRateLimitGuard,
    AdminMfaService,
  ],
  exports: [
    AdminAuthService,
    AdminSessionsService,
    AdminActivityService,
    AdminMfaService,
  ],
})
export class AdminAuthModule {}
