import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, Matches } from "class-validator";

export class CreateFeatureFlagDto {
  @ApiProperty({
    description: "Feature flag key (alphanumeric + underscores only)",
    example: "returns_module",
  })
  @IsString()
  @Matches(/^[a-z0-9_]+$/, {
    message:
      "Feature key must contain only lowercase letters, numbers, and underscores",
  })
  key: string;

  @ApiProperty({
    description: "Human-readable description of the feature",
    example: "Enable returns and refunds module",
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: "Scope type for the feature",
    enum: ["global", "store", "admin", "env"],
    required: false,
    default: "global",
  })
  @IsOptional()
  @IsString()
  type?: "global" | "store" | "admin" | "env";

  @ApiProperty({
    description: "Default enabled state",
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  defaultState?: boolean;
}
