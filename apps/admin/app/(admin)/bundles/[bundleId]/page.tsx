import { use } from "react";
import { BundleEditorPanel } from "@/components/bundles/bundle-editor-panel";

interface BundleDetailPageProps {
  params: Promise<{ bundleId: string }>;
}

/**
 * Bundle detail page - Server component
 * Extracts bundleId from params and delegates to BundleEditorPanel
 */
export default function BundleDetailPage({ params }: BundleDetailPageProps) {
  const { bundleId } = use(params);
  return <BundleEditorPanel bundleId={bundleId} />;
}
