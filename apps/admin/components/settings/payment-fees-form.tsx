"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useCreatePaymentCharge,
  usePaymentCharge,
  useUpdatePaymentCharge,
} from "@/hooks/payment-charges/use-payment-charges";

const paymentChargeSchema = z.object({
  method: z.enum([
    "COD",
    "RAZORPAY_UPI",
    "RAZORPAY_CARD",
    "STRIPE_CARD",
    "WALLET",
    "NETBANKING",
    "BNPL",
  ]),
  chargeType: z.enum(["FLAT", "PERCENTAGE", "MIXED"]),
  flatAmount: z.number().min(0),
  percentage: z.number().min(0),
  mixCap: z.number().min(0).nullable().optional(),
  mixMin: z.number().min(0).nullable().optional(),
  isTaxable: z.boolean().optional(),
  currency: z.string().optional(),
  codMaxAmount: z.number().min(0).nullable().optional(),
  codDisallowHighValue: z.boolean().optional(),
  codDisallowDigital: z.boolean().optional(),
  codDisallowPreorder: z.boolean().optional(),
  active: z.boolean().optional(),
});

type PaymentChargeFormValues = z.infer<typeof paymentChargeSchema>;

interface PaymentFeesFormProps {
  chargeId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  COD: "Cash on Delivery",
  RAZORPAY_UPI: "UPI (Razorpay)",
  RAZORPAY_CARD: "Card (Razorpay)",
  STRIPE_CARD: "Card (Stripe)",
  WALLET: "Wallet",
  NETBANKING: "Net Banking",
  BNPL: "Buy Now Pay Later",
};

export function PaymentFeesForm({
  chargeId,
  onSuccess,
  onCancel,
}: PaymentFeesFormProps) {
  const { data: existingCharge } = usePaymentCharge(chargeId || "");
  const createCharge = useCreatePaymentCharge();
  const updateCharge = useUpdatePaymentCharge(chargeId || "");

  const form = useForm<PaymentChargeFormValues>({
    resolver: zodResolver(paymentChargeSchema),
    defaultValues: {
      method: "COD",
      chargeType: "FLAT",
      flatAmount: 0,
      percentage: 0,
      mixCap: null,
      mixMin: null,
      isTaxable: false,
      currency: "INR",
      codMaxAmount: null,
      codDisallowHighValue: false,
      codDisallowDigital: true,
      codDisallowPreorder: true,
      active: true,
    },
  });

  useEffect(() => {
    if (existingCharge) {
      form.reset({
        method: existingCharge.method as
          | "COD"
          | "RAZORPAY_UPI"
          | "RAZORPAY_CARD"
          | "STRIPE_CARD"
          | "WALLET"
          | "NETBANKING"
          | "BNPL",
        chargeType: existingCharge.chargeType,
        flatAmount: existingCharge.flatAmount,
        percentage: existingCharge.percentage,
        mixCap: existingCharge.mixCap,
        mixMin: existingCharge.mixMin,
        isTaxable: existingCharge.isTaxable,
        currency: existingCharge.currency,
        codMaxAmount: existingCharge.codMaxAmount,
        codDisallowHighValue: existingCharge.codDisallowHighValue,
        codDisallowDigital: existingCharge.codDisallowDigital,
        codDisallowPreorder: existingCharge.codDisallowPreorder,
        active: existingCharge.active,
      });
    }
  }, [existingCharge, form]);

  const onSubmit = async (data: PaymentChargeFormValues) => {
    if (chargeId) {
      await updateCharge.mutateAsync(data);
    } else {
      await createCharge.mutateAsync(data);
    }
    onSuccess();
  };

  const chargeType = form.watch("chargeType");
  const method = form.watch("method");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>
              Select the payment method to configure charges for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!!chargeId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(METHOD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chargeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Charge Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FLAT">Flat Amount</SelectItem>
                      <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                      <SelectItem value="MIXED">
                        Mixed (Percentage + Flat)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    FLAT: Fixed amount charge
                    <br />
                    PERCENTAGE: Percentage-based charge
                    <br />
                    MIXED: Combination of percentage + flat with min/max caps
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Charge Configuration</CardTitle>
            <CardDescription>Configure the charge amount</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {chargeType !== "PERCENTAGE" && (
              <FormField
                control={form.control}
                name="flatAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flat Amount (in rupees)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Flat charge amount in rupees (e.g., 30 = ₹30)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {chargeType !== "FLAT" && (
              <>
                <FormField
                  control={form.control}
                  name="percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentage</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Percentage rate (e.g., 2.5 for 2.5%)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {chargeType === "MIXED" && (
                  <>
                    <FormField
                      control={form.control}
                      name="mixMin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Charge (in rupees)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                )
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum charge amount in rupees (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mixCap"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Cap (in rupees)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                )
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum charge cap in rupees (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {method === "COD" && (
          <Card>
            <CardHeader>
              <CardTitle>COD Restrictions</CardTitle>
              <CardDescription>
                Configure restrictions for Cash on Delivery
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="codMaxAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Order Value (in rupees)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseFloat(e.target.value) : null,
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum order value for COD in rupees (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="codDisallowHighValue"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Disallow High-Value Items
                      </FormLabel>
                      <FormDescription>
                        Disable COD for orders containing high-value items
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="codDisallowDigital"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Disallow Digital Products
                      </FormLabel>
                      <FormDescription>
                        Disable COD for orders containing digital products
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="codDisallowPreorder"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Disallow Preorder Items
                      </FormLabel>
                      <FormDescription>
                        Disable COD for orders containing preorder items
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Additional Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="isTaxable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Taxable</FormLabel>
                    <FormDescription>
                      Whether the payment fee is subject to GST
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Currency code (e.g., INR, USD)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Whether this charge configuration is active
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createCharge.isPending || updateCharge.isPending}
          >
            {chargeId ? "Update" : "Create"} Payment Charge
          </Button>
        </div>
      </form>
    </Form>
  );
}
