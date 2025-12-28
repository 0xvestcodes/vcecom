import { Suspense } from "react";
import { BundleDetail } from "@/components/bundles/bundle-detail";

function BundleDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-muted h-96 rounded-lg" />
          <div>
            <div className="h-8 bg-muted rounded w-3/4 mb-4" />
            <div className="h-4 bg-muted rounded w-1/2 mb-8" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BundleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BundleDetailPage({
  params,
}: BundleDetailPageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen">
      <Suspense fallback={<BundleDetailLoading />}>
        <BundleDetail bundleId={id} />
      </Suspense>
    </div>
  );
}
