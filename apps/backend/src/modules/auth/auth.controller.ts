import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Response,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  TooManyRequestsErrorDto,
  UnauthorizedErrorDto,
} from "../../common/dto/error-response.dto";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { AuthService } from "./auth.service";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { UserProfileDto } from "./dto/user-profile.dto";

@ApiTags("store")
@Controller("store/auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Register a new user",
    description:
      "Create a new user account with email and password. Returns access token and refresh token.",
  })
  @ApiCreatedResponse({
    description: "User successfully registered",
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or user already exists",
    type: BadRequestErrorDto,
  })
  @ApiConflictResponse({
    description: "Conflict - User with this email already exists",
    type: ConflictErrorDto,
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.role,
    );
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.LOGIN)
  @ApiOperation({
    summary: "Login user",
    description:
      "Authenticate user with email and password, receive JWT access token and refresh token in httpOnly cookies",
  })
  @ApiOkResponse({
    description: "User successfully authenticated",
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Invalid credentials",
    type: UnauthorizedErrorDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
    type: BadRequestErrorDto,
  })
  @ApiTooManyRequestsResponse({
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async login(
    @Body() loginDto: LoginDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<AuthResponseDto> {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    const tokens = await this.authService.login(user);

    // Set httpOnly cookies
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    };

    res.cookie("admin_access_token", tokens.access_token, cookieOptions);
    res.cookie("admin_refresh_token", tokens.refresh_token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return tokens;
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Refresh access token",
    description:
      "Get a new access token and refresh token using a valid refresh token",
  })
  @ApiOkResponse({
    description: "Tokens successfully refreshed",
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Invalid or expired refresh token",
    type: UnauthorizedErrorDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
    type: BadRequestErrorDto,
  })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<AuthResponseDto> {
    // Try to get refresh token from cookie first, then from body
    const refreshToken =
      req.cookies?.admin_refresh_token || refreshTokenDto.refresh_token;
    const tokens = await this.authService.refreshToken(refreshToken);

    // Update cookies
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    };

    res.cookie("admin_access_token", tokens.access_token, cookieOptions);
    res.cookie("admin_refresh_token", tokens.refresh_token, cookieOptions);

    return tokens;
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Logout user",
    description: "Clear authentication cookies",
  })
  @ApiOkResponse({
    description: "Successfully logged out",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Logged out successfully",
        },
      },
    },
  })
  async logout(@Response({ passthrough: true }) res: ExpressResponse) {
    res.clearCookie("admin_access_token", { path: "/" });
    res.clearCookie("admin_refresh_token", { path: "/" });
    return { message: "Logged out successfully" };
  }

  @Get("me")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get current user profile",
    description: "Get the profile of the currently authenticated user",
  })
  @ApiOkResponse({
    description: "User profile retrieved successfully",
    type: UserProfileDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async getProfile(@Request() req): Promise<UserProfileDto> {
    return {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    };
  }

  @Get("profile")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get current user profile (legacy endpoint)",
    description:
      "Get the profile of the currently authenticated user. Use /store/auth/me instead.",
  })
  @ApiOkResponse({
    description: "User profile retrieved successfully",
    type: UserProfileDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async getProfileLegacy(@Request() req): Promise<UserProfileDto> {
    return {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    };
  }

  @Get("admin-only")
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Admin-only endpoint",
    description: "This endpoint is only accessible to users with admin role",
  })
  @ApiOkResponse({
    description: "Admin access granted",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Welcome, admin!",
        },
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            role: { type: "string" },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async adminOnly(@Request() req) {
    return {
      message: "Welcome, admin!",
      user: req.user,
    };
  }

  @Get("customer-only")
  @Roles("customer")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Customer-only endpoint",
    description: "This endpoint is only accessible to users with customer role",
  })
  @ApiOkResponse({
    description: "Customer access granted",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Welcome, customer!",
        },
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            role: { type: "string" },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Customer role required.",
  })
  async customerOnly(@Request() req) {
    return {
      message: "Welcome, customer!",
      user: req.user,
    };
  }
}
