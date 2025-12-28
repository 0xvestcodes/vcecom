import { Suspense } from "react";
import { BundlesList } from "@/components/bundles/bundles-list";

function BundlesLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }, (_, i) => `skeleton-${i.toString()}`).map(
            (key) => (
              <div key={key}>
                <div className="bg-muted h-64 rounded-lg mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export default function BundlesPage() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<BundlesLoading />}>
        <BundlesList />
      </Suspense>
    </div>
  );
}
