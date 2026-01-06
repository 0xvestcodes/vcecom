import { notFound } from "next/navigation";
import { Suspense } from "react";
import { searchProducts } from "@/app/actions/products";
import { ProductCard } from "@/components/products/product-card";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { serverApiFetch } from "@/lib/server/api";

interface Category {
  id: string;
  name: string;
  slug?: string;
  description?: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
}

async function CategoryProductsList({
  categoryId,
  searchParams,
}: {
  categoryId: string;
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const result = await searchProducts({
    page,
    limit: 12,
    categoryId,
    status: "active",
  }).catch(() => ({ data: [], total: 0, page: 1, limit: 12 }));

  const products = (result as { data?: Product[] }).data || [];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {products.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No products found in this category
          </p>
        </div>
      )}
    </>
  );
}

const CATEGORY_SKELETON_KEYS = [
  "category-skeleton-0",
  "category-skeleton-1",
  "category-skeleton-2",
  "category-skeleton-3",
  "category-skeleton-4",
  "category-skeleton-5",
  "category-skeleton-6",
  "category-skeleton-7",
];

function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {CATEGORY_SKELETON_KEYS.map((key) => (
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

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;

  // Fetch all categories to find the matching one
  const categories = await serverApiFetch<Category[]>(
    "/store/categories",
  ).catch(() => []);
  const category = categories.find((c) => c.slug === slug || c.id === slug);

  if (!category) {
    notFound();
  }

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground text-lg">
            {category.description}
          </p>
        )}
      </div>
      <Suspense fallback={<ProductsSkeleton />}>
        <CategoryProductsList
          categoryId={category.id}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  );
}
