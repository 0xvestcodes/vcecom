import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class SetFeatureFlagDto {
  @ApiProperty({
    description: "Feature flag state (enabled/disabled)",
    example: true,
  })
  @IsBoolean()
  state: boolean;

  @ApiProperty({
    description: "Optional reason for the change (for audit log)",
    required: false,
    example: "Enabling for A/B testing",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
