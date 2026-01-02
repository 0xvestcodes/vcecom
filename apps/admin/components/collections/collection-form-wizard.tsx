"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
  Collection,
  CollectionRule,
  CreateCollectionInput,
  UpdateCollectionInput,
} from "@/lib/types/collections";
import type { Product } from "@/lib/types/products";
import {
  createCollectionSchema,
  updateCollectionSchema,
} from "@/lib/validations/collections";
import { CollectionBasicFields } from "./collection-basic-fields";
import { CollectionImageUpload } from "./collection-image-upload";
import { CollectionManualProducts } from "./collection-manual-products";
import { CollectionPreviewPanel } from "./collection-preview-panel";
import { CollectionRuleBuilder } from "./collection-rule-builder";
import { CollectionTypeSelector } from "./collection-type-selector";

interface CollectionFormWizardProps {
  initialData?: Collection;
  collection?: Collection;
  onSubmit: (
    data: CreateCollectionInput | UpdateCollectionInput,
  ) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

type Step = 1 | 2 | 3;

export function CollectionFormWizard({
  collection: collectionProp,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: CollectionFormWizardProps) {
  const collection = initialData || collectionProp;
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [imageUrl, setImageUrl] = useState<string | null>(
    collection?.imageUrl || null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [collectionType, setCollectionType] = useState<"manual" | "automatic">(
    collection?.type || "manual",
  );
  const [rules, setRules] = useState<CollectionRule[]>(collection?.rules || []);
  const [matchType, setMatchType] = useState<"all" | "any">(
    collection?.matchType || "all",
  );
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

  const form = useForm<CreateCollectionInput | UpdateCollectionInput>({
    resolver: zodResolver(
      collection ? updateCollectionSchema : createCollectionSchema,
    ),
    defaultValues: collection
      ? {
          name: collection.name,
          slug: collection.slug,
          description: collection.description || undefined,
          imageUrl: collection.imageUrl || undefined,
          type: collection.type || "manual",
          rules: collection.rules,
          matchType: collection.matchType || "all",
          position: collection.position,
        }
      : {
          name: "",
          slug: "",
          description: "",
          imageUrl: undefined,
          type: "manual",
          rules: [],
          matchType: "all",
          position: undefined,
        },
  });

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await form.trigger(["name", "slug", "description"]);
      if (isValid) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleSubmit = async () => {
    const formData = form.getValues();
    const submitData: CreateCollectionInput | UpdateCollectionInput = {
      ...formData,
      type: collectionType,
      imageUrl: imageUrl || undefined,
      rules: collectionType === "automatic" ? rules : undefined,
      matchType: collectionType === "automatic" ? matchType : undefined,
    };

    // For manual collections, we'll need to add products after creation
    // This is handled by the collection detail page
    await onSubmit(submitData);
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return form.watch("name");
    }
    if (currentStep === 2) {
      return collectionType;
    }
    if (currentStep === 3) {
      if (collectionType === "manual") {
        return selectedProducts.length > 0;
      } else {
        return rules.length > 0 && rules.every((r) => r.value !== "");
      }
    }
    return false;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                currentStep >= 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              1
            </div>
            <div className="h-1 w-12 bg-muted" />
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                currentStep >= 2
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              2
            </div>
            <div className="h-1 w-12 bg-muted" />
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                currentStep >= 3
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              3
            </div>
          </div>
        </div>

        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Basic Information</h2>
              <p className="text-muted-foreground">
                Enter the basic details for your collection
              </p>
            </div>
            <CollectionBasicFields form={form} />
            <CollectionImageUpload
              form={form}
              imageUrl={imageUrl}
              isUploading={isUploading}
              onImageChange={setImageUrl}
              onUploadingChange={setIsUploading}
            />
          </div>
        )}

        {/* Step 2: Type Selection */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Collection Type</h2>
              <p className="text-muted-foreground">
                Choose how products will be added to this collection
              </p>
            </div>
            <CollectionTypeSelector
              value={collectionType}
              onChange={setCollectionType}
            />
            {collectionType === "automatic" && (
              <div className="space-y-2">
                <Label>Match Type</Label>
                <RadioGroup
                  value={matchType}
                  onValueChange={(value) =>
                    setMatchType(value as "all" | "any")
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" />
                    <Label htmlFor="all" className="cursor-pointer">
                      Match ALL rules
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="any" id="any" />
                    <Label htmlFor="any" className="cursor-pointer">
                      Match ANY rule
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Content */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                {collectionType === "manual"
                  ? "Select Products"
                  : "Define Rules"}
              </h2>
              <p className="text-muted-foreground">
                {collectionType === "manual"
                  ? "Choose which products to include in this collection"
                  : "Define rules to automatically include products"}
              </p>
            </div>
            {collectionType === "manual" ? (
              <CollectionManualProducts
                selectedProducts={selectedProducts}
                onProductsChange={setSelectedProducts}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <CollectionRuleBuilder
                    rules={rules}
                    onRulesChange={setRules}
                  />
                </div>
                <div>
                  <CollectionPreviewPanel
                    collectionId={collection?.id}
                    rules={rules}
                    matchType={matchType}
                    enabled={!!collection?.id}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-6 border-t">
          <div>
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handleBack}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            {onCancel && currentStep === 1 && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed() || isUploading}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!canProceed() || isLoading || isUploading}
              >
                {isLoading
                  ? "Saving..."
                  : collection
                    ? "Update Collection"
                    : "Create Collection"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
