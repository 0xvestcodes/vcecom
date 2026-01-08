import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class QueryMediaGroupsDto {
  @ApiProperty({
    description: "Page number (1-indexed)",
    example: 1,
    default: 1,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Page must be an integer" })
  @Min(1, { message: "Page must be greater than or equal to 1" })
  page?: number = 1;

  @ApiProperty({
    description: "Number of items per page",
    example: 10,
    default: 10,
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Limit must be an integer" })
  @Min(1, { message: "Limit must be greater than or equal to 1" })
  @Max(100, { message: "Limit must be less than or equal to 100" })
  limit?: number = 10;

  @ApiProperty({
    description: "Search query (searches in name and description)",
    example: "banners",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Search query must be a string" })
  search?: string;

  @ApiProperty({
    description: "Filter by active status",
    example: true,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: "isActive must be a boolean" })
  isActive?: boolean;
}
