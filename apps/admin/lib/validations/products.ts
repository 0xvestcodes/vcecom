import * as z from "zod";

// Pre-transform schema for form (gstRate is string enum)
export const createProductFormSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must not exceed 255 characters"),
  description: z
    .string()
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),
  price: z.number().min(0, "Price must be greater than or equal to 0"),
  gstRate: z.enum(["0", "5", "12", "18", "28"]).optional(),
  pricingType: z.enum(["inclusive", "exclusive"]),
  hsnCode: z
    .string()
    .max(50, "HSN code must not exceed 50 characters")
    .optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  categoryId: z.string().uuid("Category ID must be a valid UUID").optional(),
});

// Schema with transform for API (gstRate is number)
export const createProductSchema = createProductFormSchema.transform(
  (data) => ({
    ...data,
    gstRate: data.gstRate ? parseInt(data.gstRate, 10) : undefined,
  }),
);

// Pre-transform schema for form (gstRate is string enum)
export const updateProductFormSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must not exceed 255 characters")
    .optional(),
  description: z
    .string()
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),
  price: z
    .number()
    .min(0, "Price must be greater than or equal to 0")
    .optional(),
  gstRate: z.enum(["0", "5", "12", "18", "28"]).optional(),
  pricingType: z.enum(["inclusive", "exclusive"]).optional(),
  hsnCode: z
    .string()
    .max(50, "HSN code must not exceed 50 characters")
    .optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  categoryId: z
    .string()
    .uuid("Category ID must be a valid UUID")
    .optional()
    .nullable(),
});

// Schema with transform for API (gstRate is number, categoryId null -> undefined)
export const updateProductSchema = updateProductFormSchema.transform(
  (data) => ({
    ...data,
    gstRate: data.gstRate ? parseInt(data.gstRate, 10) : undefined,
    categoryId: data.categoryId === null ? undefined : data.categoryId,
  }),
);

// Pre-transform schema for form (dates are strings)
export const createVariantFormSchema = z.object({
  productId: z.string().uuid("Product ID must be a valid UUID"),
  sku: z.string().max(100, "SKU must not exceed 100 characters").optional(),
  price: z.number().min(0, "Price must be greater than or equal to 0"),
  compareAtPrice: z
    .number()
    .min(0, "Compare-at price must be greater than or equal to 0")
    .optional(),
  currency: z.string().optional(),
  salePrice: z
    .number()
    .min(0, "Sale price must be greater than or equal to 0")
    .optional(),
  saleStartDate: z.string().datetime().optional(),
  saleEndDate: z.string().datetime().optional(),
  inventory: z
    .number()
    .int()
    .min(0, "Inventory must be greater than or equal to 0")
    .optional(),
  size: z.string().max(50, "Size must not exceed 50 characters").optional(),
  color: z.string().max(50, "Color must not exceed 50 characters").optional(),
  weight: z
    .number()
    .min(0, "Weight must be greater than or equal to 0")
    .optional(),
  optionValueIds: z
    .array(z.string().uuid("Option value ID must be a valid UUID"))
    .optional(),
});

// Schema with transform for API (dates are Date objects)
export const createVariantSchema = createVariantFormSchema.transform(
  (data) => ({
    ...data,
    saleStartDate: data.saleStartDate
      ? new Date(data.saleStartDate)
      : undefined,
    saleEndDate: data.saleEndDate ? new Date(data.saleEndDate) : undefined,
  }),
);

// Pre-transform schema for form (dates are strings)
export const updateVariantFormSchema = z.object({
  sku: z.string().max(100, "SKU must not exceed 100 characters").optional(),
  price: z
    .number()
    .min(0, "Price must be greater than or equal to 0")
    .optional(),
  compareAtPrice: z
    .number()
    .min(0, "Compare-at price must be greater than or equal to 0")
    .optional()
    .nullable(),
  currency: z.string().optional(),
  salePrice: z
    .number()
    .min(0, "Sale price must be greater than or equal to 0")
    .optional()
    .nullable(),
  saleStartDate: z.string().datetime().optional().nullable(),
  saleEndDate: z.string().datetime().optional().nullable(),
  inventory: z
    .number()
    .int()
    .min(0, "Inventory must be greater than or equal to 0")
    .optional(),
  size: z
    .string()
    .max(50, "Size must not exceed 50 characters")
    .optional()
    .nullable(),
  color: z
    .string()
    .max(50, "Color must not exceed 50 characters")
    .optional()
    .nullable(),
  weight: z
    .number()
    .min(0, "Weight must be greater than or equal to 0")
    .optional()
    .nullable(),
  optionValueIds: z
    .array(z.string().uuid("Option value ID must be a valid UUID"))
    .optional(),
});

// Schema with transform for API (dates are Date objects, null -> undefined)
export const updateVariantSchema = updateVariantFormSchema.transform(
  (data) => ({
    ...data,
    compareAtPrice:
      data.compareAtPrice === null ? undefined : data.compareAtPrice,
    salePrice: data.salePrice === null ? undefined : data.salePrice,
    saleStartDate: data.saleStartDate
      ? new Date(data.saleStartDate)
      : undefined,
    saleEndDate: data.saleEndDate ? new Date(data.saleEndDate) : undefined,
    size: data.size === null ? undefined : data.size,
    color: data.color === null ? undefined : data.color,
    weight: data.weight === null ? undefined : data.weight,
  }),
);

export const addProductImageSchema = z.object({
  imageKey: z.string().min(1, "Image key is required"),
  altText: z.string().optional(),
  order: z.number().int().optional(),
  variantId: z.string().uuid().optional(),
});

export const updateImageOrderSchema = z.object({
  order: z.number().int().min(0, "Order must be greater than or equal to 0"),
});

export type CreateProductFormValues = z.infer<typeof createProductFormSchema>;
export type UpdateProductFormValues = z.infer<typeof updateProductFormSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantFormValues = z.infer<typeof createVariantFormSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantFormValues = z.infer<typeof updateVariantFormSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type AddProductImageInput = z.infer<typeof addProductImageSchema>;
export type UpdateImageOrderInput = z.infer<typeof updateImageOrderSchema>;
