"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { AddProductsDialog } from "@/components/collections/add-products-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminCategories } from "@/hooks/categories/use-admin-categories";
import { useAdminCollections } from "@/hooks/collections/use-admin-collections";

interface DiscountBogoEditorProps {
  buyProductIds?: string[];
  buyCategoryIds?: string[];
  buyCollectionIds?: string[];
  buyTagIds?: string[];
  getProductIds?: string[];
  getCategoryIds?: string[];
  getCollectionIds?: string[];
  getTagIds?: string[];
  buyQuantity?: number;
  getQuantity?: number;
  onBuyProductIdsChange: (ids: string[]) => void;
  onBuyCategoryIdsChange: (ids: string[]) => void;
  onBuyCollectionIdsChange: (ids: string[]) => void;
  onBuyTagIdsChange: (ids: string[]) => void;
  onGetProductIdsChange: (ids: string[]) => void;
  onGetCategoryIdsChange: (ids: string[]) => void;
  onGetCollectionIdsChange: (ids: string[]) => void;
  onGetTagIdsChange: (ids: string[]) => void;
  onBuyQuantityChange: (value: number) => void;
  onGetQuantityChange: (value: number) => void;
}

export function DiscountBogoEditor({
  buyProductIds = [],
  buyCategoryIds = [],
  buyCollectionIds = [],
  buyTagIds = [],
  getProductIds = [],
  getCategoryIds = [],
  getCollectionIds = [],
  getTagIds = [],
  buyQuantity = 1,
  getQuantity = 1,
  onBuyProductIdsChange,
  onBuyCategoryIdsChange,
  onBuyCollectionIdsChange,
  onBuyTagIdsChange,
  onGetProductIdsChange,
  onGetCategoryIdsChange,
  onGetCollectionIdsChange,
  onGetTagIdsChange,
  onBuyQuantityChange,
  onGetQuantityChange,
}: DiscountBogoEditorProps) {
  const [buyProductDialogOpen, setBuyProductDialogOpen] = useState(false);
  const [getProductDialogOpen, setGetProductDialogOpen] = useState(false);

  const { data: categoriesData } = useAdminCategories();
  const { data: collectionsData } = useAdminCollections();

  const categories = categoriesData || [];
  const _collections = collectionsData?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <Label>Buy X Get Y Configuration</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Configure which products customers need to buy and which they get
          discounted
        </p>
      </div>

      {/* Buy Quantity */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Buy Quantity</Label>
          <Input
            type="number"
            min="1"
            value={buyQuantity}
            onChange={(e) =>
              onBuyQuantityChange(parseInt(e.target.value, 10) || 1)
            }
            placeholder="1"
          />
        </div>
        <div className="space-y-2">
          <Label>Get Quantity</Label>
          <Input
            type="number"
            min="1"
            value={getQuantity}
            onChange={(e) =>
              onGetQuantityChange(parseInt(e.target.value, 10) || 1)
            }
            placeholder="1"
          />
        </div>
      </div>

      {/* Buy Products */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Buy Products</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBuyProductDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Products
          </Button>
        </div>
        {buyProductIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {buyProductIds.map((id) => (
              <Badge key={id} variant="secondary" className="px-3 py-1">
                {id}
                <button
                  type="button"
                  onClick={() =>
                    onBuyProductIdsChange(
                      buyProductIds.filter((pid) => pid !== id),
                    )
                  }
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No products selected</p>
        )}
        <AddProductsDialog
          open={buyProductDialogOpen}
          onOpenChange={setBuyProductDialogOpen}
          onAdd={async (ids) => {
            onBuyProductIdsChange([...buyProductIds, ...ids]);
          }}
          existingProductIds={buyProductIds}
        />
      </div>

      {/* Buy Categories */}
      <div className="space-y-2">
        <Label>Buy Categories</Label>
        <Select
          value=""
          onValueChange={(value) => {
            if (value && !buyCategoryIds.includes(value)) {
              onBuyCategoryIdsChange([...buyCategoryIds, value]);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories
              .filter((cat) => !buyCategoryIds.includes(cat.id))
              .map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {buyCategoryIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {buyCategoryIds.map((id) => {
              const category = categories.find((c) => c.id === id);
              return (
                <Badge key={id} variant="secondary" className="px-3 py-1">
                  {category?.name || id}
                  <button
                    type="button"
                    onClick={() =>
                      onBuyCategoryIdsChange(
                        buyCategoryIds.filter((cid) => cid !== id),
                      )
                    }
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Buy Collections */}
      <div className="space-y-2">
        <Label>Buy Collections</Label>
        <Select
          value=""
          onValueChange={(value) => {
            if (value && !buyCollectionIds.includes(value)) {
              onBuyCollectionIdsChange([...buyCollectionIds, value]);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select collection" />
          </SelectTrigger>
          <SelectContent>
            {_collections
              .filter((col) => !buyCollectionIds.includes(col.id))
              .map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {buyCollectionIds && buyCollectionIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {buyCollectionIds.map((id) => {
              const collection = _collections.find((c) => c.id === id);
              return (
                <Badge key={id} variant="secondary" className="px-3 py-1">
                  {collection?.name || id}
                  <button
                    type="button"
                    onClick={() =>
                      onBuyCollectionIdsChange(
                        buyCollectionIds.filter((cid) => cid !== id),
                      )
                    }
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Get Products */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Get Products (Discounted)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setGetProductDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Products
          </Button>
        </div>
        {getProductIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {getProductIds.map((id) => (
              <Badge key={id} variant="secondary" className="px-3 py-1">
                {id}
                <button
                  type="button"
                  onClick={() =>
                    onGetProductIdsChange(
                      getProductIds.filter((pid) => pid !== id),
                    )
                  }
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No products selected</p>
        )}
        <AddProductsDialog
          open={getProductDialogOpen}
          onOpenChange={setGetProductDialogOpen}
          onAdd={async (ids) => {
            onGetProductIdsChange([...getProductIds, ...ids]);
          }}
          existingProductIds={getProductIds}
        />
      </div>

      {/* Get Categories */}
      <div className="space-y-2">
        <Label>Get Categories (Discounted)</Label>
        <Select
          value=""
          onValueChange={(value) => {
            if (value && !getCategoryIds.includes(value)) {
              onGetCategoryIdsChange([...getCategoryIds, value]);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories
              .filter((cat) => !getCategoryIds.includes(cat.id))
              .map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {getCategoryIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {getCategoryIds.map((id) => {
              const category = categories.find((c) => c.id === id);
              return (
                <Badge key={id} variant="secondary" className="px-3 py-1">
                  {category?.name || id}
                  <button
                    type="button"
                    onClick={() =>
                      onGetCategoryIdsChange(
                        getCategoryIds.filter((cid) => cid !== id),
                      )
                    }
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Get Collections */}
      <div className="space-y-2">
        <Label>Get Collections (Discounted)</Label>
        <Select
          value=""
          onValueChange={(value) => {
            if (value && !getCollectionIds.includes(value)) {
              onGetCollectionIdsChange([...getCollectionIds, value]);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select collection" />
          </SelectTrigger>
          <SelectContent>
            {_collections
              .filter((col) => !getCollectionIds.includes(col.id))
              .map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {getCollectionIds && getCollectionIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {getCollectionIds.map((id) => {
              const collection = _collections.find((c) => c.id === id);
              return (
                <Badge key={id} variant="secondary" className="px-3 py-1">
                  {collection?.name || id}
                  <button
                    type="button"
                    onClick={() =>
                      onGetCollectionIdsChange(
                        getCollectionIds.filter((cid) => cid !== id),
                      )
                    }
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
