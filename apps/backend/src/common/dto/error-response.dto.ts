import { ApiProperty } from "@nestjs/swagger";

export class BadRequestErrorDto {
  @ApiProperty({
    description: "Error status code",
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: "Error message",
    example: "Bad request - Invalid input or validation failed",
  })
  message: string | string[];

  @ApiProperty({
    description: "Error type",
    example: "BadRequestException",
  })
  error: string;
}

export class UnauthorizedErrorDto {
  @ApiProperty({
    description: "Error status code",
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: "Error message",
    example: "Unauthorized - Authentication required",
  })
  message: string;

  @ApiProperty({
    description: "Error type",
    example: "UnauthorizedException",
  })
  error: string;
}

export class ForbiddenErrorDto {
  @ApiProperty({
    description: "Error status code",
    example: 403,
  })
  statusCode: number;

  @ApiProperty({
    description: "Error message",
    example: "Forbidden - Insufficient permissions",
  })
  message: string;

  @ApiProperty({
    description: "Error type",
    example: "ForbiddenException",
  })
  error: string;
}

export class NotFoundErrorDto {
  @ApiProperty({
    description: "Error status code",
    example: 404,
  })
  statusCode: number;

  @ApiProperty({
    description: "Error message",
    example: "Resource not found",
  })
  message: string;

  @ApiProperty({
    description: "Error type",
    example: "NotFoundException",
  })
  error: string;
}

export class ConflictErrorDto {
  @ApiProperty({
    description: "Error status code",
    example: 409,
  })
  statusCode: number;

  @ApiProperty({
    description: "Error message",
    example: "Conflict - Resource already exists or state conflict",
  })
  message: string;

  @ApiProperty({
    description: "Error type",
    example: "ConflictException",
  })
  error: string;
}

export class UnprocessableEntityErrorDto {
  @ApiProperty({
    description: "Error status code",
    example: 422,
  })
  statusCode: number;

  @ApiProperty({
    description: "Error message or validation errors",
    example: ["Field validation failed", "Invalid format"],
  })
  message: string | string[];

  @ApiProperty({
    description: "Error type",
    example: "UnprocessableEntityException",
  })
  error: string;
}

export class TooManyRequestsErrorDto {
  @ApiProperty({
    description: "Error status code",
    example: 429,
  })
  statusCode: number;

  @ApiProperty({
    description: "Error message",
    example: "Too Many Requests - Rate limit exceeded",
  })
  message: string;

  @ApiProperty({
    description: "Error type",
    example: "ThrottlerException",
  })
  error: string;

  @ApiProperty({
    description: "Retry after (seconds)",
    example: 60,
    required: false,
  })
  retryAfter?: number;
}

export class InternalServerErrorDto {
  @ApiProperty({
    description: "Error status code",
    example: 500,
  })
  statusCode: number;

  @ApiProperty({
    description: "Error message",
    example: "Internal server error",
  })
  message: string;

  @ApiProperty({
    description: "Error type",
    example: "InternalServerErrorException",
  })
  error: string;
}

export class ServiceUnavailableErrorDto {
  @ApiProperty({
    description: "Error status code",
    example: 503,
  })
  statusCode: number;

  @ApiProperty({
    description: "Error message",
    example: "Service Unavailable - External service unavailable",
  })
  message: string;

  @ApiProperty({
    description: "Error type",
    example: "ServiceUnavailableException",
  })
  error: string;
}

