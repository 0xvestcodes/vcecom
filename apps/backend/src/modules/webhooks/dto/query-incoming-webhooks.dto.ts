import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class QueryIncomingWebhooksDto {
  @ApiProperty({ required: false, description: "Filter by store ID" })
  @IsString()
  @IsOptional()
  storeId?: string;

  @ApiProperty({
    required: false,
    description: "Filter by provider",
    enum: ["razorpay", "shiprocket", "nimbus_post", "generic"],
  })
  @IsEnum(["razorpay", "shiprocket", "nimbus_post", "generic"])
  @IsOptional()
  provider?: "razorpay" | "shiprocket" | "nimbus_post" | "generic";

  @ApiProperty({
    required: false,
    description: "Filter by status",
    enum: ["pending", "processed", "failed"],
  })
  @IsEnum(["pending", "processed", "failed"])
  @IsOptional()
  status?: "pending" | "processed" | "failed";

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
