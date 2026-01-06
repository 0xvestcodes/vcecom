import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";

export class QueryWebhooksDto {
  @ApiProperty({ required: false, description: "Filter by store ID" })
  @IsString()
  @IsOptional()
  storeId?: string;

  @ApiProperty({ required: false, description: "Filter by active status" })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({ required: false, description: "Filter by event type" })
  @IsString()
  @IsOptional()
  eventType?: string;

  @ApiProperty({ required: false, default: 1, description: "Page number" })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, description: "Page size" })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;
}
