"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Eye, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { EditorPanel } from "@/components/layout/editor-panel";
import { ProductDetailSkeleton } from "@/components/skeletons/product-detail-skeleton";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Form,
  FormControl,
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
import { Textarea } from "@/components/ui/textarea";
import { useAdminCategories } from "@/hooks/categories/use-admin-categories";
import { useAdminCollections } from "@/hooks/collections/use-admin-collections";
import { useAdminToggleProductCollection } from "@/hooks/collections/use-admin-toggle-product-collection";
import { useAdminDeleteProduct } from "@/hooks/products/use-admin-delete-product";
import { useAdminProduct } from "@/hooks/products/use-admin-product";
import { useAdminProductCollections } from "@/hooks/products/use-admin-product-collections";
import { useAdminProductImages } from "@/hooks/products/use-admin-product-images";
import { useAdminUpdateProduct } from "@/hooks/products/use-admin-update-product";
import { useAdminVariants } from "@/hooks/products/use-admin-variants";
import type {
  UpdateProductFormValues,
  UpdateProductInput,
} from "@/lib/validations/products";
import { updateProductFormSchema } from "@/lib/validations/products";
import { ProductCategoriesSection } from "./product-categories-section";
import { ProductCollectionsSection } from "./product-collections-section";
import { ProductDetailSummary } from "./product-detail-summary";
import { ProductImagesSection } from "./product-images-section";
import { ProductPreviewModal } from "./product-preview-modal";
import { ProductVariantsSection } from "./product-variants-section";

interface ProductEditorPanelProps {
  productId: string;
}

/**
 * Refactored Product Editor Panel using EditorPanel layout
 * Uses collapsible sections instead of tabs
 */
export function ProductEditorPanel({ productId }: ProductEditorPanelProps) {
  const router = useRouter();

  const { data: product, isLoading: isLoadingProduct } =
    useAdminProduct(productId);
  const { data: variants } = useAdminVariants(productId);
  const { data: images } = useAdminProductImages(productId);
  const { data: productCollections } = useAdminProductCollections(productId);
  const { data: allCollectionsData } = useAdminCollections({ limit: 100 });
  const { data: allCategoriesData } = useAdminCategories({ limit: 100 });
  const updateProduct = useAdminUpdateProduct(productId);
  const deleteProduct = useAdminDeleteProduct();
  const { addToCollection, removeFromCollection } =
    useAdminToggleProductCollection(productId);

  const [selectedCollectionIds, setSelectedCollectionIds] = useState<
    Set<string>
  >(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  useEffect(() => {
    if (productCollections) {
      setSelectedCollectionIds(new Set(productCollections.map((c) => c.id)));
    }
  }, [productCollections]);

  const form = useForm<UpdateProductFormValues>({
    resolver: zodResolver(updateProductFormSchema),
    values: product
      ? {
          title: product.title,
          description: product.description || undefined,
          price: product.price,
          gstRate: product.gstRate.toString() as
            | "0"
            | "5"
            | "12"
            | "18"
            | "28"
            | undefined,
          hsnCode: product.hsnCode || undefined,
          status: product.status,
          categoryId: product.categoryId || null,
        }
      : undefined,
  });

  const handleSubmit = async (data: UpdateProductFormValues) => {
    const apiData: UpdateProductInput = {
      ...data,
      gstRate: data.gstRate ? parseInt(data.gstRate, 10) : undefined,
      categoryId: data.categoryId === null ? undefined : data.categoryId,
    };
    try {
      await updateProduct.mutateAsync(apiData);
      toast.success("Product updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update product",
      );
    }
  };

  const handleCollectionToggle = async (
    collectionId: string,
    checked: boolean,
  ) => {
    if (checked) {
      try {
        await addToCollection.mutateAsync({ collectionId });
        setSelectedCollectionIds((prev) => new Set([...prev, collectionId]));
      } catch (_error) {
        // Error handled by hook
      }
    } else {
      try {
        await removeFromCollection.mutateAsync({ collectionId });
        setSelectedCollectionIds((prev) => {
          const next = new Set(prev);
          next.delete(collectionId);
          return next;
        });
      } catch (_error) {
        // Error handled by hook
      }
    }
  };

  const handleArchive = async () => {
    try {
      await updateProduct.mutateAsync({ status: "archived" });
      toast.success("Product archived successfully");
      setArchiveDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive product",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProduct.mutateAsync(productId);
      toast.success("Product deleted successfully");
      router.push("/products");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete product",
      );
    }
  };

  if (isLoadingProduct) {
    return (
      <EditorPanel title="Product" backHref="/products">
        <ProductDetailSkeleton />
      </EditorPanel>
    );
  }

  if (!product) {
    return (
      <EditorPanel title="Product Not Found" backHref="/products">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Product not found</p>
        </div>
      </EditorPanel>
    );
  }

  const allCollections = allCollectionsData?.data || [];
  const allCategories = allCategoriesData || [];

  const statusVariant =
    product.status === "active"
      ? "default"
      : product.status === "draft"
        ? "secondary"
        : "outline";

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <EditorPanel
            title={product.title}
            breadcrumbs={[
              { label: "Products", href: "/products" },
              { label: product.title },
            ]}
            status={{ label: product.status, variant: statusVariant }}
            onSave={form.handleSubmit(handleSubmit)}
            isSaving={updateProduct.isPending}
            backHref="/products"
            sidebar={
              <>
                <ProductDetailSummary
                  product={product}
                  variants={variants || []}
                />
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                </div>
              </>
            }
            warningActions={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setArchiveDialogOpen(true)}
                  disabled={product.status === "archived"}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive Product
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Product
                </Button>
              </div>
            }
          >
            {/* Basic Information Section */}
            <CollapsibleSection title="Basic Information" defaultOpen>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Product title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Product description"
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || "none"}
                          onValueChange={(value) =>
                            field.onChange(value === "none" ? null : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {allCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CollapsibleSection>

            {/* Pricing Section */}
            <CollapsibleSection title="Pricing" defaultOpen>
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gstRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST Rate (%)</FormLabel>
                      <Select
                        value={field.value || "none"}
                        onValueChange={(value) =>
                          field.onChange(value === "none" ? undefined : value)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select GST rate" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="5">5%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                          <SelectItem value="18">18%</SelectItem>
                          <SelectItem value="28">28%</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hsnCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HSN Code</FormLabel>
                      <FormControl>
                        <Input placeholder="HSN code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CollapsibleSection>

            {/* Images Section */}
            <CollapsibleSection title="Images" defaultOpen={false}>
              <ProductImagesSection
                productId={productId}
                images={images || []}
              />
            </CollapsibleSection>

            {/* Variants Section */}
            <CollapsibleSection title="Variants" defaultOpen={false}>
              <ProductVariantsSection
                productId={productId}
                variants={variants || []}
              />
            </CollapsibleSection>

            {/* Categories Section */}
            <CollapsibleSection title="Categories" defaultOpen={false}>
              <ProductCategoriesSection
                form={form}
                allCategories={allCategories}
              />
            </CollapsibleSection>

            {/* Collections Section */}
            <CollapsibleSection title="Collections" defaultOpen={false}>
              <ProductCollectionsSection
                allCollections={allCollections}
                selectedCollectionIds={selectedCollectionIds}
                onCollectionToggle={handleCollectionToggle}
              />
            </CollapsibleSection>
          </EditorPanel>
        </form>
      </Form>

      <ProductPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        product={product}
        images={images || []}
        variants={variants || []}
        collections={productCollections || []}
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive Product"
        description="Are you sure you want to archive this product? It will no longer be visible in the storefront."
        confirmText="Archive"
        onConfirm={handleArchive}
        isLoading={updateProduct.isPending}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteProduct.isPending}
      />
    </>
  );
}
