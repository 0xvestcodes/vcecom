import { ApiProperty } from "@nestjs/swagger";

export class IncomingWebhookResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  storeId!: string;

  @ApiProperty({ enum: ["razorpay", "shiprocket", "nimbus_post", "generic"] })
  provider!: "razorpay" | "shiprocket" | "nimbus_post" | "generic";

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  payload!: Record<string, unknown>;

  @ApiProperty({ required: false })
  signature?: string;

  @ApiProperty({ required: false })
  headers?: Record<string, string>;

  @ApiProperty({ enum: ["pending", "processed", "failed"] })
  status!: "pending" | "processed" | "failed";

  @ApiProperty({ required: false })
  processedAt?: Date;

  @ApiProperty({ required: false })
  errorMessage?: string;

  @ApiProperty()
  createdAt!: Date;
}
