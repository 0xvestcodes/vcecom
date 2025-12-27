export type PaymentMethodCharge =
  | "COD"
  | "RAZORPAY_UPI"
  | "RAZORPAY_CARD"
  | "STRIPE_CARD"
  | "WALLET"
  | "NETBANKING"
  | "BNPL";

export type ChargeType = "FLAT" | "PERCENTAGE" | "MIXED";

export interface PaymentMethodChargeConfig {
  id: string;
  method: PaymentMethodCharge;
  chargeType: ChargeType;
  flatAmount: number; // in rupees (backend returns in rupees)
  percentage: number;
  mixCap: number | null; // in rupees
  mixMin: number | null; // in rupees
  isTaxable: boolean;
  currency: string;
  codMaxAmount: number | null; // in rupees
  codDisallowHighValue: boolean;
  codDisallowDigital: boolean;
  codDisallowPreorder: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentChargeInput {
  method: PaymentMethodCharge;
  chargeType: ChargeType;
  flatAmount: number;
  percentage: number;
  mixCap?: number | null;
  mixMin?: number | null;
  isTaxable?: boolean;
  currency?: string;
  codMaxAmount?: number | null;
  codDisallowHighValue?: boolean;
  codDisallowDigital?: boolean;
  codDisallowPreorder?: boolean;
  active?: boolean;
}

export interface UpdatePaymentChargeInput {
  chargeType?: ChargeType;
  flatAmount?: number;
  percentage?: number;
  mixCap?: number | null;
  mixMin?: number | null;
  isTaxable?: boolean;
  currency?: string;
  codMaxAmount?: number | null;
  codDisallowHighValue?: boolean;
  codDisallowDigital?: boolean;
  codDisallowPreorder?: boolean;
  active?: boolean;
}

export interface PaymentFeePreview {
  charge: PaymentMethodChargeConfig;
  cartTotal: number;
  fee: number;
  breakdown: {
    method: string;
    chargeType: string;
    flatAmount?: number;
    percentage?: number;
    calculatedFee: number;
    mixMin?: number;
    mixCap?: number;
  };
  feeInRupees: number;
}
