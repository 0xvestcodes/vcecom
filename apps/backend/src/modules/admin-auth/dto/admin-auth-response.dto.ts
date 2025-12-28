import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsDate, IsNumber, IsString, IsUUID } from "class-validator";

export class AdminAuthResponseDto {
  @ApiProperty({
    description: "JWT access token",
    example: "eyJhbGciOiJIUzI1Ni...",
  })
  @IsString()
  accessToken: string;

  @ApiProperty({
    description: "JWT refresh token",
    example: "eyJhbGciOiJIUzI1Ni...",
  })
  @IsString()
  refreshToken: string;

  @ApiProperty({
    description: "Admin user ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: "Admin email",
    example: "admin@vcecom.local",
  })
  @IsString()
  email: string;

  @ApiProperty({
    description: "Admin role",
    example: "admin",
  })
  @IsString()
  role: "admin" | "customer" | "support" | "reviewer" | "marketing";

  @ApiProperty({
    description: "Indicates if 2FA is required for this admin",
    example: false,
  })
  @IsBoolean()
  requires2fa: boolean;
}

export class AdminSessionDto {
  @ApiProperty({
    description: "Session ID",
    example: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: "Client-generated device ID",
    example: "web-browser-12345",
  })
  @IsString()
  deviceId: string;

  @ApiProperty({
    description: "User agent string from the device",
    example:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    nullable: true,
  })
  @IsString()
  userAgent?: string;

  @ApiProperty({
    description: "IP address from which the session was created/last used",
    example: "192.168.1.1",
    nullable: true,
  })
  @IsString()
  ipAddress?: string;

  @ApiProperty({
    description: "Timestamp when the session was created",
    example: "2023-10-27T10:00:00.000Z",
  })
  @IsDate()
  createdAt: Date;

  @ApiProperty({
    description: "Timestamp when the session expires",
    example: "2023-11-26T10:00:00.000Z",
  })
  @IsDate()
  expiresAt: Date;

  @ApiProperty({
    description: "Timestamp when the session was last used for refresh",
    example: "2023-10-27T10:30:00.000Z",
  })
  @IsDate()
  lastUsedAt: Date;
}

export class AdminSessionsResponseDto {
  @ApiProperty({
    description: "List of active admin sessions",
    type: [AdminSessionDto],
  })
  sessions: AdminSessionDto[];
}

export class AdminMeResponseDto {
  @ApiProperty({
    description: "Admin user ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: "Admin email",
    example: "admin@vcecom.local",
  })
  @IsString()
  email: string;

  @ApiProperty({
    description: "Admin role",
    example: "admin",
  })
  @IsString()
  role: "admin" | "customer" | "support" | "reviewer" | "marketing";

  @ApiProperty({
    description: "Admin role ID (for granular permissions)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
    nullable: true,
  })
  @IsUUID()
  roleId?: string | null;

  @ApiProperty({
    description: "Number of active sessions for this admin",
    example: 2,
  })
  @IsNumber()
  activeSessionsCount: number;

  @ApiProperty({
    description: "Indicates if 2FA is enabled for this admin",
    example: true,
  })
  @IsBoolean()
  twoFactorEnabled: boolean;
}
