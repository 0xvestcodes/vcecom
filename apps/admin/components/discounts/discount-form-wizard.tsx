"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type CreateDiscountInput,
  DiscountApplicationType,
  DiscountType,
  DiscountValueType,
} from "@/lib/types/discounts";
import { DiscountApplicationTypeSelector } from "./discount-application-type-selector";
import { DiscountBogoEditor } from "./discount-bogo-editor";
import { DiscountConditionEditor } from "./discount-condition-editor";
import { DiscountPrioritySelector } from "./discount-priority-selector";
import { DiscountRuleBuilder } from "./discount-rule-builder";
import { DiscountSchedulingPanel } from "./discount-scheduling-panel";
import { DiscountStackingEditor } from "./discount-stacking-editor";
import { DiscountTieredEditor } from "./discount-tiered-editor";
import { DiscountTypeSelector } from "./discount-type-selector";

interface DiscountFormWizardProps {
  initialData?: Partial<CreateDiscountInput>;
  onSubmit: (data: CreateDiscountInput) => void;
  isLoading?: boolean;
}

export function DiscountFormWizard({
  initialData,
  onSubmit,
  isLoading = false,
}: DiscountFormWizardProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<CreateDiscountInput>>({
    code: initialData?.code || "",
    name: initialData?.name || "",
    description: initialData?.description || "",
    type: initialData?.type || DiscountType.PERCENTAGE,
    applicationType:
      initialData?.applicationType || DiscountApplicationType.MANUAL,
    valueType: initialData?.valueType || DiscountValueType.PERCENTAGE,
    value: initialData?.value || 0,
    priority: initialData?.priority || 1,
    canStack: initialData?.canStack ?? true,
    mutuallyExclusive: initialData?.mutuallyExclusive ?? false,
    isActive: initialData?.isActive ?? true,
    minOrderAmount: initialData?.minOrderAmount ?? undefined,
    maxDiscountAmount: initialData?.maxDiscountAmount ?? undefined,
    usageLimit: initialData?.usageLimit ?? undefined,
    perUserLimit: initialData?.perUserLimit ?? undefined,
    customerGroupIds: initialData?.customerGroupIds ?? undefined,
    startDate: initialData?.startDate || new Date().toISOString(),
    endDate: initialData?.endDate || undefined,
    productIds: initialData?.productIds || [],
    categoryIds: initialData?.categoryIds || [],
    collectionIds: initialData?.collectionIds || [],
    tagIds: initialData?.tagIds || [],
    buyProductIds: initialData?.buyProductIds || [],
    buyCategoryIds: initialData?.buyCategoryIds || [],
    buyCollectionIds: initialData?.buyCollectionIds || [],
    buyTagIds: initialData?.buyTagIds || [],
    getProductIds: initialData?.getProductIds || [],
    getCategoryIds: initialData?.getCategoryIds || [],
    getCollectionIds: initialData?.getCollectionIds || [],
    getTagIds: initialData?.getTagIds || [],
    tieredRules: initialData?.tieredRules || [],
    excludedDiscountIds: initialData?.excludedDiscountIds || [],
    // For BOGO discounts: buyQuantity maps to minQuantity, getQuantity stored separately
    minQuantity: initialData?.minQuantity ?? undefined,
  });

  // Separate state for BOGO buy/get quantities (for UI only, buyQuantity maps to minQuantity)
  const [bogoBuyQuantity, setBogoBuyQuantity] = useState<number>(
    initialData?.minQuantity || 1,
  );
  const [bogoGetQuantity, setBogoGetQuantity] = useState<number>(1);

  const updateField = <K extends keyof CreateDiscountInput>(
    field: K,
    value: CreateDiscountInput[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formData.code || !formData.name || !formData.startDate) {
      return;
    }

    // For BOGO discounts, ensure minQuantity is set from buyQuantity
    const submitData = { ...formData };
    if (formData.type === "BUY_X_GET_Y" && bogoBuyQuantity) {
      submitData.minQuantity = bogoBuyQuantity;
    }

    onSubmit(submitData as CreateDiscountInput);
  };

  const canProceed = () => {
    if (step === 1) {
      return !!(formData.code && formData.name && formData.startDate);
    }
    return true;
  };

  return (
    <div className="space-y-6">
      <Tabs
        value={String(step)}
        onValueChange={(v) => setStep(parseInt(v, 10))}
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="1">Basic Info</TabsTrigger>
          <TabsTrigger value="2">Type & Value</TabsTrigger>
          <TabsTrigger value="3">Rules & Conditions</TabsTrigger>
          <TabsTrigger value="4">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="1" className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Discount Code *</Label>
              <Input
                id="code"
                value={formData.code || ""}
                onChange={(e) => updateField("code", e.target.value)}
                placeholder="SAVE20"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Discount Name *</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="20% Off Summer Sale"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Get 20% off on all summer products"
                rows={3}
              />
            </div>

            <DiscountSchedulingPanel
              startDate={
                formData.startDate ? new Date(formData.startDate) : null
              }
              endDate={formData.endDate ? new Date(formData.endDate) : null}
              onStartDateChange={(date) =>
                updateField("startDate", date?.toISOString() || "")
              }
              onEndDateChange={(date) =>
                updateField("endDate", date?.toISOString() || undefined)
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="2" className="space-y-6">
          <DiscountTypeSelector
            value={formData.type}
            onValueChange={(value) => updateField("type", value)}
          />

          <DiscountApplicationTypeSelector
            value={formData.applicationType}
            onValueChange={(value) => updateField("applicationType", value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Value Type *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={formData.valueType}
                onChange={(e) =>
                  updateField("valueType", e.target.value as DiscountValueType)
                }
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="AMOUNT">Fixed Amount</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>
                Value *{" "}
                {formData.valueType === "PERCENTAGE" ? "(0-100)" : "(INR)"}
              </Label>
              <Input
                type="number"
                min="0"
                max={formData.valueType === "PERCENTAGE" ? 100 : undefined}
                value={formData.value || ""}
                onChange={(e) =>
                  updateField("value", parseFloat(e.target.value) || 0)
                }
                placeholder="20"
                required
              />
            </div>
          </div>

          {formData.type === "BUY_X_GET_Y" && (
            <DiscountBogoEditor
              buyProductIds={formData.buyProductIds || []}
              buyCategoryIds={formData.buyCategoryIds || []}
              buyCollectionIds={formData.buyCollectionIds || []}
              buyTagIds={formData.buyTagIds || []}
              getProductIds={formData.getProductIds || []}
              getCategoryIds={formData.getCategoryIds || []}
              getCollectionIds={formData.getCollectionIds || []}
              getTagIds={formData.getTagIds || []}
              buyQuantity={bogoBuyQuantity}
              getQuantity={bogoGetQuantity}
              onBuyProductIdsChange={(ids) => updateField("buyProductIds", ids)}
              onBuyCategoryIdsChange={(ids) =>
                updateField("buyCategoryIds", ids)
              }
              onBuyCollectionIdsChange={(ids) =>
                updateField("buyCollectionIds", ids)
              }
              onBuyTagIdsChange={(ids) => updateField("buyTagIds", ids)}
              onGetProductIdsChange={(ids) => updateField("getProductIds", ids)}
              onGetCategoryIdsChange={(ids) =>
                updateField("getCategoryIds", ids)
              }
              onGetCollectionIdsChange={(ids) =>
                updateField("getCollectionIds", ids)
              }
              onGetTagIdsChange={(ids) => updateField("getTagIds", ids)}
              onBuyQuantityChange={(value) => {
                setBogoBuyQuantity(value);
                updateField("minQuantity", value);
              }}
              onGetQuantityChange={(value) => {
                setBogoGetQuantity(value);
                // Note: Backend currently uses 1:1 ratio, getQuantity is stored for future use
              }}
            />
          )}

          {formData.type === "TIERED" && (
            <DiscountTieredEditor
              tieredRules={formData.tieredRules || []}
              onTieredRulesChange={(rules) => updateField("tieredRules", rules)}
            />
          )}
        </TabsContent>

        <TabsContent value="3" className="space-y-6">
          {(formData.type === "FIXED_AMOUNT" ||
            formData.type === "PERCENTAGE") && (
            <DiscountRuleBuilder
              productIds={formData.productIds || []}
              categoryIds={formData.categoryIds || []}
              collectionIds={formData.collectionIds || []}
              onProductIdsChange={(ids) => updateField("productIds", ids)}
              onCategoryIdsChange={(ids) => updateField("categoryIds", ids)}
              onCollectionIdsChange={(ids) => updateField("collectionIds", ids)}
            />
          )}

          <DiscountConditionEditor
            minOrderAmount={formData.minOrderAmount}
            maxDiscountAmount={formData.maxDiscountAmount}
            usageLimit={formData.usageLimit}
            perUserLimit={formData.perUserLimit}
            customerGroupIds={formData.customerGroupIds}
            onMinOrderAmountChange={(value) =>
              updateField("minOrderAmount", value ?? undefined)
            }
            onMaxDiscountAmountChange={(value) =>
              updateField("maxDiscountAmount", value ?? undefined)
            }
            onUsageLimitChange={(value) =>
              updateField("usageLimit", value ?? undefined)
            }
            onPerUserLimitChange={(value) =>
              updateField("perUserLimit", value ?? undefined)
            }
            onCustomerGroupIdsChange={(value) =>
              updateField("customerGroupIds", value ?? undefined)
            }
          />
        </TabsContent>

        <TabsContent value="4" className="space-y-6">
          <DiscountPrioritySelector
            value={formData.priority}
            onValueChange={(value) => updateField("priority", value)}
          />

          <DiscountStackingEditor
            canStack={formData.canStack ?? true}
            mutuallyExclusive={formData.mutuallyExclusive ?? false}
            onCanStackChange={(value) => updateField("canStack", value)}
            onMutuallyExclusiveChange={(value) =>
              updateField("mutuallyExclusive", value)
            }
          />

          <div className="flex items-start space-x-3 rounded-md border p-4">
            <Checkbox
              id="isActive"
              checked={formData.isActive ?? true}
              onCheckedChange={(checked) =>
                updateField("isActive", checked === true)
              }
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="isActive" className="cursor-pointer">
                Active
              </Label>
              <p className="text-sm text-muted-foreground">
                Inactive discounts won't be applied
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
        >
          Previous
        </Button>
        {step < 4 ? (
          <Button
            type="button"
            onClick={() => setStep(Math.min(4, step + 1))}
            disabled={!canProceed()}
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed() || isLoading}
          >
            {isLoading ? "Saving..." : "Save Discount"}
          </Button>
        )}
      </div>
    </div>
  );
}
