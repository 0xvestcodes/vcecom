import { ApiProperty } from "@nestjs/swagger";

export class WebhookResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  storeId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ type: [String] })
  events!: string[];

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  timeoutMs!: number;

  @ApiProperty()
  retryConfig!: {
    maxAttempts: number;
    backoffMs: number[];
  };

  @ApiProperty({ required: false })
  headers?: Record<string, string>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
