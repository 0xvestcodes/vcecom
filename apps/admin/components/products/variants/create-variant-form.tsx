"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminCreateVariant } from "@/hooks/products/use-admin-create-variant";
import { useAdminProductVariantOptionTypes } from "@/hooks/products/use-admin-product-variant-option-types";
import type {
  CreateVariantFormValues,
  CreateVariantInput,
} from "@/lib/validations/products";
import {
  createVariantFormSchema,
  createVariantSchema,
} from "@/lib/validations/products";

interface CreateVariantFormProps {
  productId: string;
  productTitle: string;
  defaultPrice?: number;
}

export function CreateVariantForm({
  productId,
  productTitle,
  defaultPrice = 0,
}: CreateVariantFormProps) {
  const router = useRouter();
  const { data: optionTypes = [] } =
    useAdminProductVariantOptionTypes(productId);
  const createVariant = useAdminCreateVariant(productId);

  const [selectedOptionValues, setSelectedOptionValues] = useState<
    Map<string, string>
  >(new Map());

  const form = useForm<CreateVariantFormValues>({
    resolver: zodResolver(createVariantFormSchema),
    defaultValues: {
      productId,
      price: defaultPrice,
      currency: "INR",
      inventory: 0,
    },
  });

  useEffect(() => {
    if (defaultPrice) {
      form.setValue("price", defaultPrice);
    }
  }, [defaultPrice, form]);

  const onSubmit = async (data: CreateVariantFormValues) => {
    try {
      const optionValueIds = Array.from(selectedOptionValues.values()).filter(
        Boolean,
      );

      const variantData: CreateVariantInput = createVariantSchema.parse({
        ...data,
        productId,
        optionValueIds: optionValueIds.length > 0 ? optionValueIds : undefined,
      });
      await createVariant.mutateAsync(variantData);
      // Don't navigate - let parent handle completion
      // router.push(`/products/${productId}/variants/${variant.id}`);
    } catch (_error) {
      // Error is handled by the hook's onError callback
    }
  };

  const handleOptionValueSelect = (optionTypeId: string, valueId: string) => {
    setSelectedOptionValues((prev) => {
      const newMap = new Map(prev);
      if (valueId) {
        newMap.set(optionTypeId, valueId);
      } else {
        newMap.delete(optionTypeId);
      }
      return newMap;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Variant Information</CardTitle>
                <CardDescription>Basic variant details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    {...form.register("sku")}
                    placeholder="Auto-generated if empty"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-generate SKU
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inventory">Initial Inventory</Label>
                  <Input
                    id="inventory"
                    type="number"
                    step="1"
                    min="0"
                    {...form.register("inventory", { valueAsNumber: true })}
                    placeholder="0"
                  />
                </div>
              </CardContent>
            </Card>

            {optionTypes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Variant Options</CardTitle>
                  <CardDescription>
                    Select one value for each option type to define this variant
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {optionTypes.map((optionType) => {
                    const values = optionType.values || [];
                    const selectedValueId = selectedOptionValues.get(
                      optionType.id,
                    );

                    if (values.length === 0) {
                      return (
                        <div key={optionType.id} className="space-y-2">
                          <Label className="text-base font-medium">
                            {optionType.name}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            No values available. Add values to this option type
                            first.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div key={optionType.id} className="space-y-3">
                        <Label className="text-base font-medium">
                          {optionType.name}
                        </Label>
                        <RadioGroup
                          value={selectedValueId || ""}
                          onValueChange={(valueId) =>
                            handleOptionValueSelect(optionType.id, valueId)
                          }
                        >
                          <div className="grid grid-cols-2 gap-3">
                            {values.map((value) => (
                              <div
                                key={value.id}
                                className="flex items-center space-x-2"
                              >
                                <RadioGroupItem
                                  value={value.id}
                                  id={`option-${value.id}`}
                                />
                                <Label
                                  htmlFor={`option-${value.id}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {value.value}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </RadioGroup>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {optionTypes.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Variant Options</CardTitle>
                  <CardDescription>
                    No variant options configured
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    This product doesn't have any variant option types
                    configured. You can create a variant without options, or add
                    option types first.
                  </p>
                  <Button variant="outline" asChild>
                    <Link href={`/products/${productId}`}>
                      Go to Product Page to Add Options
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>Set variant pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Base Price (INR) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("price", { valueAsNumber: true })}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="compareAtPrice">Compare-at Price (INR)</Label>
                  <Input
                    id="compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("compareAtPrice", {
                      valueAsNumber: true,
                    })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salePrice">Sale Price (INR)</Label>
                  <Input
                    id="salePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("salePrice", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="saleStartDate">Sale Start Date</Label>
                    <Input
                      id="saleStartDate"
                      type="datetime-local"
                      {...form.register("saleStartDate")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="saleEndDate">Sale End Date</Label>
                    <Input
                      id="saleEndDate"
                      type="datetime-local"
                      {...form.register("saleEndDate")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Product</div>
              <div className="font-medium">{productTitle}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Base Price</div>
              <div className="font-medium">
                ₹{form.watch("price")?.toFixed(2) || "0.00"}
              </div>
            </div>

            {selectedOptionValues.size > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  Selected Options
                </div>
                <div className="space-y-2">
                  {optionTypes.map((optionType) => {
                    const selectedValueId = selectedOptionValues.get(
                      optionType.id,
                    );
                    if (!selectedValueId) return null;
                    const selectedValue = optionType.values?.find(
                      (v) => v.id === selectedValueId,
                    );
                    if (!selectedValue) return null;
                    return (
                      <div key={optionType.id} className="text-sm">
                        <span className="font-medium">{optionType.name}:</span>{" "}
                        <span className="text-muted-foreground">
                          {selectedValue.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-3 flex gap-2 justify-end">
        <Button variant="outline" asChild>
          <Link href={`/products/${productId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={createVariant.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          Create Variant
        </Button>
      </div>
    </div>
  );
}
