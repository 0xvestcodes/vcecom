"use client";

import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

interface ProductPickerProps {
  value?: string;
  onChange: (productId: string | null) => void;
  multiple?: boolean;
}

/**
 * Product Picker Component
 * Allows selecting products for CMS blocks/references
 */
export function ProductPicker({
  value,
  onChange,
  multiple = false,
}: ProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: products, isLoading } = useQuery<
    Array<{ id: string; title: string }>
  >({
    queryKey: ["products", "search", search],
    queryFn: async () => {
      const response = await api.get<{
        data?: Array<{ id: string; title: string }>;
      }>(
        endpoints.products.list +
          `?search=${encodeURIComponent(search)}&limit=20`,
      );
      return response &&
        typeof response === "object" &&
        "data" in response &&
        Array.isArray(response.data)
        ? response.data
        : [];
    },
    enabled: open,
  });

  const handleSelect = (productId: string) => {
    if (multiple) {
      // Handle multiple selection
      const current = Array.isArray(value) ? value : value ? [value] : [];
      if (current.includes(productId)) {
        onChange(current.filter((id) => id !== productId) as unknown as string);
      } else {
        onChange([...current, productId] as unknown as string);
      }
    } else {
      onChange(value === productId ? null : productId);
      setOpen(false);
    }
  };

  const selectedIds = multiple
    ? Array.isArray(value)
      ? value
      : value
        ? [value]
        : []
    : value
      ? [value]
      : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          {value ? `Product Selected` : "Select Product"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading products...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto">
              {products?.map((product) => (
                <Card
                  key={product.id}
                  className={`cursor-pointer hover:bg-muted ${
                    selectedIds.includes(product.id) ? "border-primary" : ""
                  }`}
                  onClick={() => handleSelect(product.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <span>{product.title}</span>
                    {selectedIds.includes(product.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
