import { Suspense } from "react";
import { searchProducts } from "@/app/actions/products";
import { ProductCard } from "@/components/products/product-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
}

async function SearchResults({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const page = parseInt(params.page || "1", 10);

  if (!query) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Enter a search term to find products
        </p>
      </div>
    );
  }

  const result = await searchProducts({
    page,
    limit: 12,
    search: query,
    status: "active",
  }).catch(() => ({ data: [], total: 0, page: 1, limit: 12 }));

  const products = (result as { data?: Product[] }).data || [];

  return (
    <>
      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No products found for "{query}"
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-6">
            Found {products.length} result{products.length !== 1 ? "s" : ""} for
            "{query}"
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ProductsSkeleton() {
  const skeletonKeys = Array.from(
    { length: 8 },
    (_, i) => `search-skeleton-${i}`,
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {skeletonKeys.map((key) => (
        <Card key={key} className="overflow-hidden border-0">
          <Skeleton className="aspect-square w-full" />
          <div className="p-4">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-6">Search Products</h1>
        <form className="max-w-md" action="/search" method="get">
          <Input
            name="q"
            type="search"
            placeholder="Search products..."
            defaultValue={query}
            className="w-full"
          />
        </form>
      </div>
      <Suspense fallback={<ProductsSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
