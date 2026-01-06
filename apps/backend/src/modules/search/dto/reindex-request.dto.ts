import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export enum ReindexEntityType {
  PRODUCTS = "products",
  COLLECTIONS = "collections",
  ALL = "all",
}

export class ReindexRequestDto {
  @ApiProperty({
    description: "Entity type to reindex",
    enum: ReindexEntityType,
    default: ReindexEntityType.ALL,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReindexEntityType)
  entityType?: ReindexEntityType = ReindexEntityType.ALL;

  @ApiProperty({
    description: "Filter by category ID (for products only)",
    required: false,
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({
    description: "Filter by collection ID",
    required: false,
  })
  @IsOptional()
  @IsString()
  collectionId?: string;

  @ApiProperty({
    description: "Filter products/collections created from this date",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description: "Filter products/collections created until this date",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description: "Batch size for indexing",
    default: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchSize?: number;
}
