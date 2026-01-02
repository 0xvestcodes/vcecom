import type { BlockCategory, BlockType } from "@vcecom/cms-blocks";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/**
 * Form component props for block forms
 */
export interface BlockFormProps<
  T extends FieldValues = Record<string, unknown>,
> {
  form: UseFormReturn<T>;
  onSubmit?: (data: T) => void;
  onCancel?: () => void;
}

/**
 * Block metadata for admin UI
 */
export interface BlockMetadata {
  type: BlockType;
  displayName: string;
  description: string;
  category: BlockCategory;
  icon?: string; // Icon identifier (e.g., "Hero", "Image")
  thumbnail?: React.ComponentType<{ className?: string }>;
}

/**
 * Block form component type
 */
export type BlockFormComponent<
  T extends FieldValues = Record<string, unknown>,
> = React.ComponentType<BlockFormProps<T>>;
