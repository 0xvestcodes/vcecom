import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from "class-validator";
import { GeoLocationDto } from "./geo-location.dto";

export enum GeoRuleType {
  RESTRICTED = "RESTRICTED",
  ALLOWED = "ALLOWED",
}

export enum GeoRuleAction {
  BLOCK = "BLOCK",
  WARN = "WARN",
  REDIRECT = "REDIRECT",
}

export class CreateGeoRuleDto {
  @ApiProperty({
    description: "Rule name",
    example: "Restrict International Access",
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: "Rule type",
    enum: GeoRuleType,
    example: GeoRuleType.RESTRICTED,
  })
  @IsEnum(GeoRuleType)
  type: GeoRuleType;

  @ApiProperty({
    description: "Array of country codes (ISO 3166-1 alpha-2)",
    example: ["US", "CA"],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiProperty({
    description: "Array of state codes/names",
    example: ["CA", "NY"],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states?: string[];

  @ApiProperty({
    description: "Action to take",
    enum: GeoRuleAction,
    example: GeoRuleAction.WARN,
    default: GeoRuleAction.WARN,
  })
  @IsEnum(GeoRuleAction)
  @IsOptional()
  action?: GeoRuleAction;

  @ApiProperty({
    description: "Redirect URL (required for REDIRECT action)",
    example: "https://example.com/restricted",
    required: false,
  })
  @IsOptional()
  @IsUrl()
  redirectUrl?: string;

  @ApiProperty({
    description: "Custom warning message",
    example: "This region is restricted",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  warningMessage?: string;

  @ApiProperty({
    description: "Is rule active",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: "Priority (higher = higher priority)",
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

export class UpdateGeoRuleDto {
  @ApiProperty({
    description: "Rule name",
    example: "Restrict International Access",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: "Rule type",
    enum: GeoRuleType,
    example: GeoRuleType.RESTRICTED,
    required: false,
  })
  @IsOptional()
  @IsEnum(GeoRuleType)
  type?: GeoRuleType;

  @ApiProperty({
    description: "Array of country codes (ISO 3166-1 alpha-2)",
    example: ["US", "CA"],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiProperty({
    description: "Array of state codes/names",
    example: ["CA", "NY"],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states?: string[];

  @ApiProperty({
    description: "Action to take",
    enum: GeoRuleAction,
    example: GeoRuleAction.WARN,
    required: false,
  })
  @IsOptional()
  @IsEnum(GeoRuleAction)
  action?: GeoRuleAction;

  @ApiProperty({
    description: "Redirect URL (required for REDIRECT action)",
    example: "https://example.com/restricted",
    required: false,
  })
  @IsOptional()
  @IsUrl()
  redirectUrl?: string;

  @ApiProperty({
    description: "Custom warning message",
    example: "This region is restricted",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  warningMessage?: string;

  @ApiProperty({
    description: "Is rule active",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: "Priority (higher = higher priority)",
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

export class GeoRuleResponseDto {
  @ApiProperty({
    description: "Rule ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Rule name",
    example: "Restrict International Access",
  })
  name: string;

  @ApiProperty({
    description: "Rule type",
    enum: GeoRuleType,
    example: GeoRuleType.RESTRICTED,
  })
  type: GeoRuleType;

  @ApiProperty({
    description: "Array of country codes",
    example: ["US", "CA"],
    nullable: true,
  })
  countries: string[] | null;

  @ApiProperty({
    description: "Array of state codes/names",
    example: ["CA", "NY"],
    nullable: true,
  })
  states: string[] | null;

  @ApiProperty({
    description: "Action to take",
    enum: GeoRuleAction,
    example: GeoRuleAction.WARN,
  })
  action: GeoRuleAction;

  @ApiProperty({
    description: "Redirect URL",
    example: "https://example.com/restricted",
    nullable: true,
  })
  redirectUrl: string | null;

  @ApiProperty({
    description: "Custom warning message",
    example: "This region is restricted",
    nullable: true,
  })
  warningMessage: string | null;

  @ApiProperty({
    description: "Is rule active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Priority",
    example: 0,
  })
  priority: number;

  @ApiProperty({
    description: "Created at",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Updated at",
    example: "2024-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}

export class LocationCheckResponseDto {
  @ApiProperty({
    description: "Location information",
    type: GeoLocationDto,
  })
  location: GeoLocationDto;

  @ApiProperty({
    description: "Is location restricted",
    example: false,
  })
  isRestricted: boolean;

  @ApiProperty({
    description: "Warning message if restricted",
    example: "This region is restricted",
    nullable: true,
  })
  warningMessage?: string | null;

  @ApiProperty({
    description: "Redirect URL if action is REDIRECT",
    example: "https://example.com/restricted",
    nullable: true,
  })
  redirectUrl?: string | null;

  @ApiProperty({
    description: "Action to take",
    enum: GeoRuleAction,
    example: GeoRuleAction.WARN,
    nullable: true,
  })
  action?: GeoRuleAction | null;
}
