import { Suspense } from "react";
import { searchProducts } from "@/app/actions/products";
import { ProductCard } from "@/components/products/product-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

async function ProductsList({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; inStock?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const search = params.search || "";
  // Allow filtering by stock status, but don't filter by default
  const inStock =
    params.inStock !== undefined ? params.inStock === "true" : undefined;

  const result = await searchProducts({
    page,
    limit: 12,
    search: search || undefined,
    status: "active",
    ...(inStock !== undefined && { inStock }),
  }).catch(() => ({ data: [], total: 0, page: 1, limit: 12 }));

  interface Product {
    id: string;
    title: string;
    price: number;
    images: string[];
  }

  const products = (result as { data?: Product[] }).data || [];
  const total = (result as { total?: number }).total || 0;
  const limit = (result as { limit?: number }).limit || 12;
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {products.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No products found</p>
        </div>
      )}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        baseUrl="/products"
        searchParams={{
          ...(search && { search }),
          ...(inStock !== undefined && { inStock: String(inStock) }),
        }}
      />
    </>
  );
}

const PRODUCTS_SKELETON_KEYS = [
  "products-skeleton-0",
  "products-skeleton-1",
  "products-skeleton-2",
  "products-skeleton-3",
  "products-skeleton-4",
  "products-skeleton-5",
  "products-skeleton-6",
  "products-skeleton-7",
];

function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {PRODUCTS_SKELETON_KEYS.map((key) => (
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-6">All Products</h1>
        <form className="max-w-md" action="/products" method="get">
          <Input
            name="search"
            type="search"
            placeholder="Search products..."
            defaultValue={params.search}
            className="w-full"
          />
        </form>
      </div>
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
