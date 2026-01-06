import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class QueryWebhookLogsDto {
  @ApiProperty({ required: false, description: "Filter by webhook ID" })
  @IsString()
  @IsOptional()
  webhookId?: string;

  @ApiProperty({
    required: false,
    description: "Filter by status",
    enum: ["pending", "success", "failed"],
  })
  @IsEnum(["pending", "success", "failed"])
  @IsOptional()
  status?: "pending" | "success" | "failed";

  @ApiProperty({ required: false, description: "Filter by event type" })
  @IsString()
  @IsOptional()
  eventType?: string;

  @ApiProperty({ required: false, description: "Filter by event ID" })
  @IsString()
  @IsOptional()
  eventId?: string;

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
