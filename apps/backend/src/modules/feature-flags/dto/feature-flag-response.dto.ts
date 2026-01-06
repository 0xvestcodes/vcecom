import { ApiProperty } from "@nestjs/swagger";

export class FeatureFlagActiveScopeDto {
  @ApiProperty({
    enum: ["admin", "store", "environment"],
    example: "admin",
  })
  type: "admin" | "store" | "environment";

  @ApiProperty({
    example: "uuid-of-admin-or-store",
  })
  id: string;
}

export class FeatureFlagResponseDto {
  @ApiProperty({
    example: "returns_module",
  })
  key: string;

  @ApiProperty({
    example: "Enable returns and refunds module",
  })
  description: string;

  @ApiProperty({
    enum: ["global", "store", "admin", "env"],
    example: "global",
  })
  type: string;

  @ApiProperty({
    example: false,
  })
  defaultState: boolean;

  @ApiProperty({
    example: true,
    description: "Resolved state for current context",
  })
  currentState: boolean;

  @ApiProperty({
    type: FeatureFlagActiveScopeDto,
    required: false,
    description: "Active scope override (if any)",
  })
  activeScope?: FeatureFlagActiveScopeDto;

  @ApiProperty({
    example: "2024-01-01T00:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    example: "2024-01-01T00:00:00Z",
  })
  updatedAt: Date;
}

export class FeatureFlagListResponseDto {
  @ApiProperty({
    type: [FeatureFlagResponseDto],
  })
  flags: FeatureFlagResponseDto[];
}

export class FeatureFlagHistoryEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  featureKey: string;

  @ApiProperty({ required: false })
  scopeType?: string;

  @ApiProperty({ required: false })
  scopeId?: string;

  @ApiProperty({ required: false })
  oldState?: boolean;

  @ApiProperty()
  newState: boolean;

  @ApiProperty()
  changedBy: string;

  @ApiProperty({ required: false })
  changeReason?: string;

  @ApiProperty()
  createdAt: Date;
}

export class FeatureFlagHistoryResponseDto {
  @ApiProperty({
    type: [FeatureFlagHistoryEntryDto],
  })
  history: FeatureFlagHistoryEntryDto[];
}
