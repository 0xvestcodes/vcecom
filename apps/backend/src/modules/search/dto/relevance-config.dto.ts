import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class FieldWeightsDto {
  @ApiProperty({ description: "Title field weight", default: 2.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  title?: number;

  @ApiProperty({ description: "Description field weight", default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  description?: number;

  @ApiProperty({ description: "SKU field weight", default: 1.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sku?: number;

  @ApiProperty({ description: "Tags field weight", default: 1.2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tags?: number;

  @ApiProperty({ description: "Collection names field weight", default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  collectionNames?: number;
}

export class BoostFactorsDto {
  @ApiProperty({ description: "Popularity boost factor", default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  popularity?: number;

  @ApiProperty({ description: "Recency boost factor", default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  recency?: number;

  @ApiProperty({ description: "Inventory status boost factor", default: 1.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  inventoryStatus?: number;
}

export class RelevanceConfigDto {
  @ApiProperty({ type: FieldWeightsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => FieldWeightsDto)
  fieldWeights?: FieldWeightsDto;

  @ApiProperty({ type: BoostFactorsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => BoostFactorsDto)
  boostFactors?: BoostFactorsDto;

  @ApiProperty({
    description: "Synonyms mapping",
    type: "object",
    additionalProperties: { type: "array", items: { type: "string" } },
  })
  @IsOptional()
  @IsObject()
  synonyms?: Record<string, string[]>;

  @ApiProperty({
    description: "Stop words",
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stopWords?: string[];

  @ApiProperty({
    description: "Ranking rules",
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rankingRules?: string[];
}
