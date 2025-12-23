import { UserBundleSelection } from "../../bundles/services/bundle-eligibility.service";

/**
 * Bundle snapshot stored in cart item metadata
 */
export interface BundleSnapshot {
  bundleId: string;
  bundleTitle: string;
  selections: UserBundleSelection;
  unitBundlePrice: number;
  variantBreakdown: Array<{
    variantId: string;
    unitPrice: number;
    quantity: number;
  }>;
}

/**
 * Bundle cart item metadata structure
 * Stored in cart_items.metadata JSONB column
 */
export interface BundleCartItemMetadata {
  type: "bundle";
  bundleId: string;
  selections: UserBundleSelection;
  bundleTitle?: string;
  bundleSnapshot?: BundleSnapshot;
}

/**
 * Flattened bundle item metadata
 * Used when bundles are flattened into individual cart items
 */
export interface FlattenedBundleItemMetadata {
  fromBundle: true;
  bundleId: string;
  bundleTitle: string;
  bundleGroupId: string; // Same for all items from same bundle instance
  bundleSetId?: string; // Optional: which set this variant came from
}
