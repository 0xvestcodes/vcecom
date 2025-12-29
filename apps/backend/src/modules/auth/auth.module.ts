import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { getValidatedJwtSecret } from "../../common/config/jwt-secret.validation";
import { AdminAuthModule } from "../admin-auth/admin-auth.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
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
    AdminAuthModule, // Import AdminAuthModule to make AdminSessionsService available to JwtStrategy
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
