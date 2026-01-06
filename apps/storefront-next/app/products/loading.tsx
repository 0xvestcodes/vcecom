import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PRODUCTS_LOADING_SKELETON_KEYS = [
  "products-loading-0",
  "products-loading-1",
  "products-loading-2",
  "products-loading-3",
  "products-loading-4",
  "products-loading-5",
  "products-loading-6",
  "products-loading-7",
];

export default function ProductsLoading() {
  return (
    <div className="container py-10">
      <div className="mb-8">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-10 w-full max-w-md" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {PRODUCTS_LOADING_SKELETON_KEYS.map((key) => (
          <Card key={key} className="overflow-hidden border-0">
            <Skeleton className="aspect-square w-full" />
            <div className="p-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
