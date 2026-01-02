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

interface CollectionPickerProps {
  value?: string;
  onChange: (collectionId: string | null) => void;
  multiple?: boolean;
}

/**
 * Collection Picker Component
 * Allows selecting collections for CMS blocks/references
 */
export function CollectionPicker({
  value,
  onChange,
  multiple = false,
}: CollectionPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: collections, isLoading } = useQuery<
    Array<{ id: string; name: string }>
  >({
    queryKey: ["collections", "search", search],
    queryFn: async () => {
      const response = await api.get<{
        data?: Array<{ id: string; name: string }>;
      }>(
        endpoints.collections.list +
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

  const handleSelect = (collectionId: string) => {
    if (multiple) {
      // Handle multiple selection
      const current = Array.isArray(value) ? value : value ? [value] : [];
      if (current.includes(collectionId)) {
        onChange(
          current.filter((id) => id !== collectionId) as unknown as string,
        );
      } else {
        onChange([...current, collectionId] as unknown as string);
      }
    } else {
      onChange(value === collectionId ? null : collectionId);
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
          {value ? `Collection Selected` : "Select Collection"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search collections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading collections...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto">
              {collections?.map((collection) => (
                <Card
                  key={collection.id}
                  className={`cursor-pointer hover:bg-muted ${
                    selectedIds.includes(collection.id) ? "border-primary" : ""
                  }`}
                  onClick={() => handleSelect(collection.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <span>{collection.name}</span>
                    {selectedIds.includes(collection.id) && (
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
