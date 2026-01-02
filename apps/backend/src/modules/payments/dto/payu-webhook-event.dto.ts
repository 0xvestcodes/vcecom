import { ApiProperty } from "@nestjs/swagger";

export class PayUWebhookEventDto {
  @ApiProperty({
    description: "PayU transaction ID",
    example: "txn_1234567890",
  })
  txnid: string;

  @ApiProperty({
    description: "Payment status",
    example: "success",
  })
  status: string;

  @ApiProperty({
    description: "PayU payment hash",
    example: "abc123def456...",
  })
  hash: string;

  @ApiProperty({
    description: "Amount paid",
    example: 100000,
  })
  amount: number;

  @ApiProperty({
    description: "Product information",
    example: "Order #ORD-2025-001234",
  })
  productinfo: string;

  @ApiProperty({
    description: "Customer first name",
    example: "John",
  })
  firstname: string;

  @ApiProperty({
    description: "Customer email",
    example: "john@example.com",
  })
  email: string;

  @ApiProperty({
    description: "PayU payment ID",
    example: "payu_1234567890",
    required: false,
  })
  payuMoneyId?: string;

  @ApiProperty({
    description: "Payment mode",
    example: "CC",
    required: false,
  })
  mode?: string;

  @ApiProperty({
    description: "Bank reference number",
    example: "BANK123456",
    required: false,
  })
  bank_ref_num?: string;

  @ApiProperty({
    description: "Bank code",
    example: "HDFC",
    required: false,
  })
  bankcode?: string;

  @ApiProperty({
    description: "Additional user defined fields",
    required: false,
  })
  udf?: {
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
    udf6?: string;
    udf7?: string;
    udf8?: string;
    udf9?: string;
    udf10?: string;
  };
}
