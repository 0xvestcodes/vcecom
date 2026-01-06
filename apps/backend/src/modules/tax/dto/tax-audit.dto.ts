import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";

export class QueryTaxAuditLogsDto {
  @ApiProperty({
    description: "Order ID to filter by",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID(4, { message: "Order ID must be a valid UUID" })
  orderId?: string;

  @ApiProperty({
    description: "Cart ID to filter by",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID(4, { message: "Cart ID must be a valid UUID" })
  cartId?: string;

  @ApiProperty({
    description: "Customer ID to filter by",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID(4, { message: "Customer ID must be a valid UUID" })
  customerId?: string;

  @ApiProperty({
    description: "Event type to filter by",
    example: "CALCULATION",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Event type must be a string" })
  event?: string;
}

export class TaxAuditLogResponseDto {
  @ApiProperty({
    description: "Audit log ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  timestamp: Date;

  @ApiProperty({
    description: "Event type",
    example: "CALCULATION",
  })
  event: string;

  @ApiProperty({
    description: "Severity",
    example: "INFO",
  })
  severity: string;

  @ApiProperty({
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  orderId: string | null;

  @ApiProperty({
    description: "Cart ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  cartId: string | null;

  @ApiProperty({
    description: "Customer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  customerId: string | null;

  @ApiProperty({
    description: "Applied tax rules",
    nullable: true,
    type: "array",
  })
  appliedTaxRules?: Array<{
    ruleId: string;
    ruleName: string;
    ruleType: string;
    gstRate: number;
  }>;

  @ApiProperty({
    description: "Applied exemptions",
    nullable: true,
    type: "array",
  })
  appliedExemptions?: Array<{
    exemptionId: string;
    exemptionName: string;
    exemptionType: string;
  }>;

  @ApiProperty({
    description: "Resolved GST rate",
    nullable: true,
  })
  resolvedGstRate: number | null;

  @ApiProperty({
    description: "Base amount",
    nullable: true,
  })
  baseAmount: number | null;

  @ApiProperty({
    description: "Tax amount",
    nullable: true,
  })
  taxAmount: number | null;

  @ApiProperty({
    description: "Calculation details",
    nullable: true,
    type: "object",
    additionalProperties: true,
  })
  calculationDetails?: {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
  };

  @ApiProperty({
    description: "Metadata",
    nullable: true,
    type: "object",
    additionalProperties: true,
  })
  metadata?: Record<string, unknown>;
}
