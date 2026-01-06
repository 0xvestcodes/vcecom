import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ScheduleModule } from "@nestjs/schedule";
import { getValidatedJwtSecret } from "../../common/config/jwt-secret.validation";
import { ContextModule } from "../../common/logging/context.module";
import { LoggerModule } from "../../common/logging/logger.module";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { SecurityModule } from "../security/security.module";
import { AdminActivityService } from "./admin-activity.service";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AdminMfaController } from "./admin-mfa.controller";
import { AdminMfaService } from "./admin-mfa.service";
import { AdminSessionsService } from "./admin-sessions.service";
import { AdminLoginRateLimitGuard } from "./guards/rate-limit.guard";
import { SecretRotationScheduler } from "./schedulers/secret-rotation.scheduler";
import { AdminBootstrapService } from "./services/admin-bootstrap.service";
import { IpHeuristicsService } from "./services/ip-heuristics.service";
import { LoginAnomalyDetectionService } from "./services/login-anomaly-detection.service";
import { RiskScoringService } from "./services/risk-scoring.service";
import { SecretRotationService } from "./services/secret-rotation.service";
import { SecurityAlertsService } from "./services/security-alerts.service";
import { SessionSigningService } from "./services/session-signing.service";

@Module({
  imports: [
    PassportModule,
    ScheduleModule,
    JwtModule.register({
      secret: getValidatedJwtSecret(),
      signOptions: {
        expiresIn: process.env.ADMIN_ACCESS_TOKEN_EXPIRES_IN || "15m",
      },
    }),
    RedisStoreModule,
    DatabaseModule,
    LoggerModule,
    ContextModule,
    NotificationsModule,
    SecurityModule, // Import SecurityModule for IP reputation and heuristic services
    forwardRef(() => AuthModule), // Import AuthModule to get JwtRotationService
  ],
  controllers: [AdminAuthController, AdminMfaController],
  providers: [
    AdminAuthService,
    AdminSessionsService,
    AdminActivityService,
    AdminLoginRateLimitGuard,
    AdminMfaService,
    SecretRotationService,
    SecretRotationScheduler,
    RiskScoringService,
    SecurityAlertsService,
    LoginAnomalyDetectionService,
    SessionSigningService,
    IpHeuristicsService,
    AdminBootstrapService, // Ensure admin exists on startup
  ],
  exports: [
    AdminAuthService,
    AdminSessionsService,
    AdminActivityService,
    AdminMfaService,
    SecretRotationService,
    SessionSigningService,
  ],
})
export class AdminAuthModule {}
