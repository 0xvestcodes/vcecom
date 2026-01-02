"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { endpoints, get } from "@/lib/api/client";
import { collectionSchema } from "@/lib/validations/collection";

export function CollectionsList() {
  const { data: collections, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const data = await get(endpoints.collections.list);
      return Array.isArray(data)
        ? data.map((c) => collectionSchema.parse(c))
        : [];
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-8" />
          <div className="grid md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`skeleton-${i.toString()}`}
                className="h-32 bg-muted rounded"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Collections</h1>

      {!collections || collections.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No collections found</p>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <Link key={collection.id} href={`/collections/${collection.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-2">
                    {collection.name}
                  </h2>
                  {collection.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {collection.description}
                    </p>
                  )}
                  {collection.productCount !== undefined && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {collection.productCount} products
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
