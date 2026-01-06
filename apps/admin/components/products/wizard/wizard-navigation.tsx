"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WIZARD_BUTTON_LABELS } from "@/lib/constants/wizard.constants";

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  isSubmitting: boolean;
  isCreatingProduct: boolean;
  isUploadingImages?: boolean;
  tempProductId: string | null;
  variantMode: "none" | "hasVariants";
  pendingVariantsCount: number;
  onPrevious: () => void;
  onNext: () => void;
  onCompleteVariants: () => void;
  onGoBackToVariants: () => void;
}

/**
 * Navigation controls for wizard
 * Handles Previous/Next buttons and conditional submit buttons
 */
export function WizardNavigation({
  currentStep,
  totalSteps,
  isSubmitting,
  isCreatingProduct,
  isUploadingImages = false,
  tempProductId,
  variantMode,
  pendingVariantsCount,
  onPrevious,
  onNext,
  onCompleteVariants,
  onGoBackToVariants,
}: WizardNavigationProps) {
  const isLastStep = currentStep === totalSteps;
  const needsVariantCreation = Boolean(
    tempProductId &&
      variantMode === "hasVariants" &&
      pendingVariantsCount === 0,
  );
  const canCompleteVariants = Boolean(
    tempProductId && variantMode === "hasVariants" && pendingVariantsCount > 0,
  );

  return (
    <div className="flex justify-between">
      <Button
        type="button"
        variant="outline"
        onClick={onPrevious}
        disabled={currentStep === 1}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        {WIZARD_BUTTON_LABELS.PREVIOUS}
      </Button>

      {isLastStep ? (
        <LastStepActions
          needsVariantCreation={needsVariantCreation}
          canCompleteVariants={canCompleteVariants}
          isSubmitting={isSubmitting}
          isUploadingImages={isUploadingImages}
          onCompleteVariants={onCompleteVariants}
          onGoBackToVariants={onGoBackToVariants}
          isCreatingProduct={isCreatingProduct}
        />
      ) : (
        <Button
          type="button"
          onClick={onNext}
          disabled={isSubmitting || isUploadingImages}
        >
          {WIZARD_BUTTON_LABELS.NEXT}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface LastStepActionsProps {
  needsVariantCreation: boolean;
  canCompleteVariants: boolean;
  isSubmitting: boolean;
  isUploadingImages: boolean;
  isCreatingProduct: boolean;
  onCompleteVariants: () => void;
  onGoBackToVariants: () => void;
}

/**
 * Actions available on the last step
 */
function LastStepActions({
  needsVariantCreation,
  canCompleteVariants,
  isSubmitting,
  isUploadingImages,
  isCreatingProduct,
  onCompleteVariants,
  onGoBackToVariants,
}: LastStepActionsProps) {
  if (needsVariantCreation) {
    return (
      <Button type="button" onClick={onGoBackToVariants}>
        {WIZARD_BUTTON_LABELS.GO_BACK_TO_VARIANTS}
        <ChevronLeft className="ml-2 h-4 w-4" />
      </Button>
    );
  }

  if (canCompleteVariants) {
    return (
      <Button
        type="button"
        onClick={onCompleteVariants}
        disabled={isSubmitting || isUploadingImages}
      >
        {isSubmitting || isUploadingImages
          ? WIZARD_BUTTON_LABELS.CREATING_VARIANTS
          : WIZARD_BUTTON_LABELS.COMPLETE_VARIANTS}
      </Button>
    );
  }

  return (
    <Button
      type="submit"
      disabled={isSubmitting || isCreatingProduct || isUploadingImages}
    >
      {isSubmitting || isCreatingProduct || isUploadingImages
        ? isUploadingImages
          ? "Uploading images..."
          : WIZARD_BUTTON_LABELS.CREATING
        : WIZARD_BUTTON_LABELS.CREATE_PRODUCT}
    </Button>
  );
}
