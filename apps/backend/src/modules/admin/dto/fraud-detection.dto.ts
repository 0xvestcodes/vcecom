import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export enum BlacklistType {
  EMAIL = "email",
  PHONE = "phone",
  ADDRESS = "address",
}

export class AddToBlacklistDto {
  @ApiProperty({
    enum: BlacklistType,
    description: "Type of blacklist entry",
    example: BlacklistType.EMAIL,
  })
  @IsEnum(BlacklistType)
  @IsNotEmpty()
  type: BlacklistType;

  @ApiProperty({
    description: "Value to blacklist (email, phone, or address)",
    example: "fraud@example.com",
  })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({
    description: "Reason for blacklisting",
    example: "Multiple chargebacks",
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class FraudBlacklistDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: BlacklistType })
  type: BlacklistType;

  @ApiProperty()
  value: string;

  @ApiPropertyOptional()
  reason: string | null;

  @ApiPropertyOptional()
  createdBy: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedBlacklistResponseDto {
  @ApiProperty({ type: [FraudBlacklistDto] })
  data: FraudBlacklistDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class FraudFlaggedOrderDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  riskScore: number;

  @ApiProperty({
    description: "Risk factors that contributed to the risk score",
    type: "object",
    additionalProperties: true,
  })
  riskFactors: Record<string, unknown>;

  @ApiProperty()
  flagged: boolean;

  @ApiPropertyOptional()
  reviewedBy: string | null;

  @ApiPropertyOptional()
  reviewedAt: Date | null;

  @ApiPropertyOptional()
  reviewNotes: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedFlaggedOrdersResponseDto {
  @ApiProperty({ type: [FraudFlaggedOrderDto] })
  data: FraudFlaggedOrderDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class ReviewOrderDto {
  @ApiPropertyOptional({
    description: "Notes from admin review",
    example: "Customer verified, legitimate order",
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

export class FraudRiskScoreDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  riskScore: number;

  @ApiProperty({
    description: "Risk factors that contributed to the risk score",
    type: "object",
    additionalProperties: true,
  })
  riskFactors: Record<string, unknown>;

  @ApiProperty()
  flagged: boolean;

  @ApiPropertyOptional()
  reviewedBy: string | null;

  @ApiPropertyOptional()
  reviewedAt: Date | null;

  @ApiPropertyOptional()
  reviewNotes: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
