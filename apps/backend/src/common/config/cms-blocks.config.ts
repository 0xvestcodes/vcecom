/**
 * CMS Block Types Configuration
 *
 * Defines all available block types with their schemas and validation rules
 */

export interface BlockSchema {
  type: string;
  displayName: string;
  description?: string;
  fields: Array<{
    name: string;
    type:
      | "text"
      | "number"
      | "boolean"
      | "image"
      | "url"
      | "reference"
      | "array";
    label: string;
    required?: boolean;
    defaultValue?: unknown;
    referenceType?: "product" | "collection";
    validation?: {
      min?: number;
      max?: number;
      pattern?: string;
    };
  }>;
  presentation?: {
    component?: string;
    className?: string;
  };
}

export const CMS_BLOCK_TYPES: Record<string, BlockSchema> = {
  hero: {
    type: "hero",
    displayName: "Hero Section",
    description: "Large hero banner with title, subtitle, image, and CTA",
    fields: [
      { name: "title", type: "text", label: "Title", required: true },
      { name: "subtitle", type: "text", label: "Subtitle" },
      { name: "backgroundImage", type: "image", label: "Background Image" },
      { name: "ctaText", type: "text", label: "CTA Text" },
      { name: "ctaLink", type: "url", label: "CTA Link" },
    ],
  },
  rich_text: {
    type: "rich_text",
    displayName: "Rich Text",
    description: "Rich text content with formatting",
    fields: [
      { name: "content", type: "text", label: "Content", required: true },
    ],
  },
  image: {
    type: "image",
    displayName: "Image",
    description: "Single image block",
    fields: [
      { name: "src", type: "image", label: "Image", required: true },
      { name: "alt", type: "text", label: "Alt Text" },
      { name: "caption", type: "text", label: "Caption" },
    ],
  },
  product_reference: {
    type: "product_reference",
    displayName: "Product Reference",
    description: "Reference to a single product",
    fields: [
      {
        name: "productId",
        type: "reference",
        label: "Product",
        required: true,
        referenceType: "product",
      },
    ],
  },
  product_list: {
    type: "product_list",
    displayName: "Product List",
    description: "List of products",
    fields: [
      {
        name: "productIds",
        type: "array",
        label: "Products",
        required: true,
      },
      { name: "title", type: "text", label: "Title" },
      { name: "limit", type: "number", label: "Limit", defaultValue: 10 },
    ],
  },
  collection_reference: {
    type: "collection_reference",
    displayName: "Collection Reference",
    description: "Reference to a collection",
    fields: [
      {
        name: "collectionId",
        type: "reference",
        label: "Collection",
        required: true,
        referenceType: "collection",
      },
    ],
  },
  button: {
    type: "button",
    displayName: "Button/CTA",
    description: "Call-to-action button",
    fields: [
      { name: "text", type: "text", label: "Button Text", required: true },
      { name: "url", type: "url", label: "Link URL", required: true },
      {
        name: "variant",
        type: "text",
        label: "Variant",
        defaultValue: "primary",
      },
    ],
  },
  grid: {
    type: "grid",
    displayName: "Grid",
    description: "Grid layout for multiple blocks",
    fields: [
      { name: "columns", type: "number", label: "Columns", defaultValue: 2 },
      { name: "blocks", type: "array", label: "Blocks", required: true },
    ],
  },
  faq: {
    type: "faq",
    displayName: "FAQ",
    description: "Frequently asked questions",
    fields: [
      {
        name: "items",
        type: "array",
        label: "FAQ Items",
        required: true,
      },
    ],
  },
  testimonials: {
    type: "testimonials",
    displayName: "Testimonials",
    description: "Customer testimonials",
    fields: [
      {
        name: "items",
        type: "array",
        label: "Testimonials",
        required: true,
      },
    ],
  },
  pricing_table: {
    type: "pricing_table",
    displayName: "Pricing Table",
    description: "Pricing comparison table",
    fields: [
      { name: "title", type: "text", label: "Title" },
      {
        name: "plans",
        type: "array",
        label: "Plans",
        required: true,
      },
    ],
  },
} as const;

/**
 * Get block schema by type
 */
export function getBlockSchema(type: string): BlockSchema | undefined {
  return CMS_BLOCK_TYPES[type];
}

/**
 * Validate block data against schema
 */
export function validateBlockData(block: {
  type: string;
  data: Record<string, unknown>;
}): { valid: boolean; errors: string[] } {
  const schema = getBlockSchema(block.type);
  if (!schema) {
    return {
      valid: false,
      errors: [`Unknown block type: ${block.type}`],
    };
  }

  const errors: string[] = [];

  for (const field of schema.fields) {
    const value = block.data[field.name];

    // Check required fields
    if (
      field.required &&
      (value === undefined || value === null || value === "")
    ) {
      errors.push(`Field "${field.label}" is required`);
    }

    // Type validation
    if (value !== undefined && value !== null) {
      switch (field.type) {
        case "number":
          if (typeof value !== "number") {
            errors.push(`Field "${field.label}" must be a number`);
          } else {
            if (
              field.validation?.min !== undefined &&
              value < field.validation.min
            ) {
              errors.push(
                `Field "${field.label}" must be at least ${field.validation.min}`,
              );
            }
            if (
              field.validation?.max !== undefined &&
              value > field.validation.max
            ) {
              errors.push(
                `Field "${field.label}" must be at most ${field.validation.max}`,
              );
            }
          }
          break;
        case "boolean":
          if (typeof value !== "boolean") {
            errors.push(`Field "${field.label}" must be a boolean`);
          }
          break;
        case "array":
          if (!Array.isArray(value)) {
            errors.push(`Field "${field.label}" must be an array`);
          }
          break;
        case "reference":
          if (field.referenceType && typeof value !== "string") {
            errors.push(
              `Field "${field.label}" must be a valid ${field.referenceType} ID`,
            );
          }
          break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
