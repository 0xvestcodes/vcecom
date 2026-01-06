import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class TestWebhookDto {
  @ApiProperty({
    description: "Test payload to send",
    required: false,
    example: { test: true, message: "Test webhook" },
  })
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiProperty({
    description: "Test event type",
    required: false,
    example: "order.created",
  })
  @IsString()
  @IsOptional()
  eventType?: string;
}
