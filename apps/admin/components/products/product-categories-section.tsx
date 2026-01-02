"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/lib/types/categories";
import type { UpdateProductFormValues } from "@/lib/validations/products";

interface ProductCategoriesSectionProps {
  form: UseFormReturn<UpdateProductFormValues>;
  allCategories: Category[];
}

export function ProductCategoriesSection({
  form,
  allCategories,
}: ProductCategoriesSectionProps) {
  const selectedCategory = allCategories.find(
    (c) => c.id === form.watch("categoryId"),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Assign this product to a category
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/products/categories/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Category
          </Link>
        </Button>
      </div>

      <FormField
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Category</FormLabel>
            <Select
              value={field.value || "none"}
              onValueChange={(value) =>
                field.onChange(value === "none" ? null : value)
              }
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {allCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      {selectedCategory && (
        <Card className="border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Selected Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm font-medium">Name:</span>
              <span className="text-sm text-muted-foreground ml-2">
                {selectedCategory.name}
              </span>
            </div>
            {selectedCategory.slug && (
              <div>
                <span className="text-sm font-medium">Slug:</span>
                <span className="text-sm text-muted-foreground ml-2">
                  {selectedCategory.slug}
                </span>
              </div>
            )}
            {selectedCategory.description && (
              <div>
                <span className="text-sm font-medium">Description:</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedCategory.description}
                </p>
              </div>
            )}
            {selectedCategory.imageUrl && (
              <div>
                <span className="text-sm font-medium">Image:</span>
                <div className="mt-2 relative w-16 h-16">
                  <Image
                    src={selectedCategory.imageUrl}
                    alt={selectedCategory.name}
                    fill
                    className="object-cover rounded border"
                    unoptimized
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
