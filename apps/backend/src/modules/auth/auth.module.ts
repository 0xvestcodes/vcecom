import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { getValidatedJwtSecret } from "../../common/config/jwt-secret.validation";
import { AdminAuthModule } from "../admin-auth/admin-auth.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtRotationService } from "./services/jwt-rotation.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      secret: getValidatedJwtSecret(),
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      },
    }),
    forwardRef(() => AdminAuthModule), // Import AdminAuthModule to make AdminSessionsService and SecretRotationService available
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRotationService],
  exports: [AuthService, JwtRotationService],
})
export class AuthModule {}
