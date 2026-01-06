import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";

export enum PaymentMethodChargeEnum {
  COD = "COD",
  RAZORPAY_UPI = "RAZORPAY_UPI",
  RAZORPAY_CARD = "RAZORPAY_CARD",
  STRIPE_CARD = "STRIPE_CARD",
  WALLET = "WALLET",
  NETBANKING = "NETBANKING",
  BNPL = "BNPL",
}

export enum ChargeTypeEnum {
  FLAT = "FLAT",
  PERCENTAGE = "PERCENTAGE",
  MIXED = "MIXED",
}

export class CreatePaymentChargeDto {
  @ApiProperty({
    description: "Payment method",
    enum: PaymentMethodChargeEnum,
    example: "COD",
  })
  @IsNotEmpty()
  @IsEnum(PaymentMethodChargeEnum)
  method: PaymentMethodChargeEnum;

  @ApiProperty({
    description: "Charge type",
    enum: ChargeTypeEnum,
    example: "FLAT",
  })
  @IsNotEmpty()
  @IsEnum(ChargeTypeEnum)
  chargeType: ChargeTypeEnum;

  @ApiProperty({
    description: "Flat amount in rupees",
    example: 30,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  flatAmount: number;

  @ApiProperty({
    description: "Percentage rate (e.g., 2.5 for 2.5%)",
    example: 2.5,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  percentage: number;

  @ApiProperty({
    description: "Maximum cap in rupees (for MIXED type)",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => o.chargeType === ChargeTypeEnum.MIXED)
  mixCap?: number;

  @ApiProperty({
    description: "Minimum charge in rupees (for MIXED type)",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => o.chargeType === ChargeTypeEnum.MIXED)
  mixMin?: number;

  @ApiProperty({
    description: "Whether fee is taxable",
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isTaxable?: boolean;

  @ApiProperty({
    description: "Currency code",
    example: "INR",
    default: "INR",
  })
  @IsString()
  @IsOptional()
  currency?: string;

  // COD-specific restrictions
  @ApiProperty({
    description: "Maximum order value for COD in rupees",
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  codMaxAmount?: number;

  @ApiProperty({
    description: "Disallow COD for high-value items",
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  codDisallowHighValue?: boolean;

  @ApiProperty({
    description: "Disallow COD for digital products",
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  codDisallowDigital?: boolean;

  @ApiProperty({
    description: "Disallow COD for preorder items",
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  codDisallowPreorder?: boolean;

  @ApiProperty({
    description: "Whether this charge configuration is active",
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiProperty({
    description: "Whether this payment method is disabled at store level",
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  storeLevelDisabled?: boolean;
}

export class UpdatePaymentChargeDto {
  @ApiProperty({
    description: "Charge type",
    enum: ChargeTypeEnum,
    required: false,
  })
  @IsOptional()
  @IsEnum(ChargeTypeEnum)
  chargeType?: ChargeTypeEnum;

  @ApiProperty({
    description: "Flat amount in rupees",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatAmount?: number;

  @ApiProperty({
    description: "Percentage rate",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  percentage?: number;

  @ApiProperty({
    description: "Maximum cap in rupees (for MIXED type)",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  mixCap?: number;

  @ApiProperty({
    description: "Minimum charge in rupees (for MIXED type)",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  mixMin?: number;

  @ApiProperty({
    description: "Whether fee is taxable",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @ApiProperty({
    description: "Currency code",
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: "Maximum order value for COD in rupees",
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  codMaxAmount?: number;

  @ApiProperty({
    description: "Disallow COD for high-value items",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  codDisallowHighValue?: boolean;

  @ApiProperty({
    description: "Disallow COD for digital products",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  codDisallowDigital?: boolean;

  @ApiProperty({
    description: "Disallow COD for preorder items",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  codDisallowPreorder?: boolean;

  @ApiProperty({
    description: "Whether this charge configuration is active",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({
    description: "Whether this payment method is disabled at store level",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  storeLevelDisabled?: boolean;
}

export class PreviewFeeDto {
  @ApiProperty({
    description: "Payment method charge configuration ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsString()
  chargeId: string;

  @ApiProperty({
    description: "Test cart total in rupees",
    example: 1000,
  })
  @IsNumber()
  @Min(0)
  cartTotal: number;
}
