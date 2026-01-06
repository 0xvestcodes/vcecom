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

export class CreateWebhookDto {
  @ApiProperty({ description: "Webhook name" })
  @IsString()
  name!: string;

  @ApiProperty({ description: "Webhook URL" })
  @IsUrl()
  url!: string;

  @ApiProperty({
    description: "Array of event types to subscribe to",
    example: ["order.created", "product.updated"],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @ApiProperty({ description: "Secret for HMAC signing" })
  @IsString()
  secret!: string;

  @ApiProperty({ description: "Whether webhook is active", default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: "Request timeout in milliseconds",
    default: 30000,
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
