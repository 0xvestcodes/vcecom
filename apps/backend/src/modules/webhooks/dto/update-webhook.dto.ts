import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from "class-validator";

export class UpdateWebhookDto {
  @ApiProperty({ description: "Webhook name", required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: "Webhook URL", required: false })
  @IsUrl()
  @IsOptional()
  url?: string;

  @ApiProperty({
    description: "Array of event types to subscribe to",
    example: ["order.created", "product.updated"],
    type: [String],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];

  @ApiProperty({ description: "Secret for HMAC signing", required: false })
  @IsString()
  @IsOptional()
  secret?: string;

  @ApiProperty({ description: "Whether webhook is active", required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: "Request timeout in milliseconds",
    required: false,
  })
  @IsNumber()
  @Min(1000)
  @IsOptional()
  timeoutMs?: number;

  @ApiProperty({
    description: "Retry configuration",
    required: false,
    example: {
      maxAttempts: 5,
      backoffMs: [1000, 5000, 30000, 300000, 1800000],
    },
  })
  @IsObject()
  @IsOptional()
  retryConfig?: {
    maxAttempts: number;
    backoffMs: number[];
  };

  @ApiProperty({
    description: "Custom headers to include in webhook requests",
    required: false,
    example: { "X-Custom-Header": "value" },
  })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;
}
