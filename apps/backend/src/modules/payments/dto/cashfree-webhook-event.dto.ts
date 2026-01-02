import { ApiProperty } from "@nestjs/swagger";

export class CashfreeWebhookEventDto {
  @ApiProperty({
    description: "Event type",
    example: "PAYMENT_SUCCESS_WEBHOOK",
  })
  type: string;

  @ApiProperty({
    description: "Event data",
  })
  data: {
    order?: {
      orderId: string;
      orderAmount: number;
      orderCurrency: string;
      orderStatus: string;
      orderTime: string;
      orderTags?: Record<string, string>;
    };
    payment?: {
      cfPaymentId: string;
      paymentStatus: string;
      paymentAmount: number;
      paymentCurrency: string;
      paymentMessage: string;
      paymentTime: string;
      bankReference?: string;
      authId?: string;
      paymentMethod?: {
        paymentMethod: string;
        card?: {
          cardNumber?: string;
          cardNetwork?: string;
          cardType?: string;
          cardIssuer?: string;
        };
        upi?: {
          payerAccount?: string;
          payerVpa?: string;
        };
      };
    };
    customerDetails?: {
      customerId?: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
    };
  };

  @ApiProperty({
    description: "Event timestamp",
    example: "2025-01-01T00:00:00Z",
  })
  eventTime: string;
}
