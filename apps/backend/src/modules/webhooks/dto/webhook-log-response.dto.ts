import { ApiProperty } from "@nestjs/swagger";

export class WebhookLogResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  webhookId!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  eventId!: string;

  @ApiProperty({ enum: ["pending", "success", "failed"] })
  status!: "pending" | "success" | "failed";

  @ApiProperty()
  attemptCount!: number;

  @ApiProperty({ required: false })
  responseStatus?: number;

  @ApiProperty({ required: false })
  responseBody?: string;

  @ApiProperty()
  requestBody!: Record<string, unknown>;

  @ApiProperty({ required: false })
  errorMessage?: string;

  @ApiProperty({ required: false })
  deliveredAt?: Date;

  @ApiProperty()
  createdAt!: Date;
}
