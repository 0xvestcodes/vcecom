import { Injectable, NotFoundException } from "@nestjs/common";
import { BundleResponseDto } from "../dto/bundle-response.dto";
import { BundleDefinitionService } from "./bundle-definition.service";

export interface UserBundleSelection {
  [setId: string]: string[]; // setId -> array of variantIds
}

export interface BundleEligibilityResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class BundleEligibilityService {
  constructor(
    private readonly bundleDefinitionService: BundleDefinitionService,
  ) {}

  /**
   * Get full hydrated bundle structure
   */
  async getBundle(bundleId: string) {
    return this.bundleDefinitionService.findOne(bundleId);
  }

  /**
   * Validate user's bundle selection
   * Selection format: { setId1: [variantId1, variantId2], setId2: [variantId3] }
   */
  async validateUserSelection(
    bundleId: string,
    selection: UserBundleSelection,
  ): Promise<BundleEligibilityResult> {
    const errors: string[] = [];

    // Get bundle with all sets and items
    let bundle: BundleResponseDto | null = null;
    try {
      bundle = await this.bundleDefinitionService.findOne(bundleId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          isValid: false,
          errors: [`Bundle with ID ${bundleId} not found`],
        };
      }
      throw error;
    }

    if (!bundle) {
      return {
        isValid: false,
        errors: [`Bundle with ID ${bundleId} not found`],
      };
    }

    // Validate all sets are present in selection
    const setIds = bundle.sets.map((set) => set.id);
    const selectionSetIds = Object.keys(selection);

    // Check for missing sets
    const missingSets = setIds.filter((id) => !selectionSetIds.includes(id));
    if (missingSets.length > 0) {
      errors.push(`Missing selections for sets: ${missingSets.join(", ")}`);
    }

    // Check for extra sets (sets not in bundle)
    const extraSets = selectionSetIds.filter((id) => !setIds.includes(id));
    if (extraSets.length > 0) {
      errors.push(`Invalid sets in selection: ${extraSets.join(", ")}`);
    }

    // Validate each set's selection
    for (const set of bundle.sets) {
      const selectedVariants = selection[set.id] || [];

      // Check quantity constraints
      if (selectedVariants.length < set.minQuantity) {
        errors.push(
          `Set "${set.title}" requires at least ${set.minQuantity} selection(s), but ${selectedVariants.length} provided`,
        );
      }

      if (selectedVariants.length > set.maxQuantity) {
        errors.push(
          `Set "${set.title}" allows at most ${set.maxQuantity} selection(s), but ${selectedVariants.length} provided`,
        );
      }

      // Duplicates are now allowed within set selections
      // No duplicate check needed

      // Validate each variant is allowed in the set
      const allowedVariantIds = set.items.map((item) => item.variantId);
      for (const variantId of selectedVariants) {
        if (!allowedVariantIds.includes(variantId)) {
          errors.push(
            `Variant ${variantId} is not allowed in set "${set.title}"`,
          );
        }
      }
    }

    // Duplicates are now allowed across sets as well
    // No duplicate check needed even if bundle doesn't allow mix and match

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
